// Supabase implementation of the engine Store (tables of migrations/20261023120000_adaptive_engine.sql).
// Uses the service role: the learning tables have no client policies.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { Posterior } from "../_shared/core/bandit/allocator.ts";
import type { Arm } from "../_shared/core/types.ts";
import type {
  AdaptiveDecisionRow,
  AttemptRow,
  AttemptStep,
  BankQuestion,
  FeedbackDecisionRow,
  LearnerRow,
  NewAttempt,
  NewSession,
  SessionRow,
  Store,
  XpAward,
} from "../_shared/engine/store.ts";
import type { CallLogger } from "../_shared/llm/call.ts";
import { awardXp } from "./award.ts";

const UNIQUE_VIOLATION = "23505";

export interface SessionMeta {
  core_commit: string;
  prompt_version: string;
  grader_model: string;
  tutor_model: string;
}

function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

export class SupabaseStore implements Store {
  constructor(
    private readonly db: SupabaseClient,
    private readonly meta: SessionMeta,
    private readonly now: () => Date,
  ) {}

  async getLearner(userId: string): Promise<LearnerRow | null> {
    return must(
      await this.db.from("learners").select("user_id, learner_id, grade_band, adaptive").eq("user_id", userId).maybeSingle(),
      "load learner",
    ) as LearnerRow | null;
  }

  async getBank(): Promise<BankQuestion[]> {
    const rows = must(await this.db.from("bank_items").select("*").eq("active", true), "load bank") as BankQuestion[];
    return rows;
  }

  async getSessions(learnerId: string): Promise<SessionRow[]> {
    return must(
      await this.db.from("learning_sessions").select("*").eq("learner_id", learnerId).order("session_index"),
      "load sessions",
    ) as SessionRow[];
  }

  async createSession(s: NewSession): Promise<SessionRow | null> {
    const { data, error } = await this.db
      .from("learning_sessions")
      .insert({ ...s, ...this.meta })
      .select("*")
      .single();
    if (error?.code === UNIQUE_VIOLATION) return null;
    if (error) throw new Error(`create session: ${error.message}`);
    return data as SessionRow;
  }

  async endSession(sessionId: string, quitEarly: boolean): Promise<void> {
    must(
      await this.db
        .from("learning_sessions")
        .update({ ended_at: this.now().toISOString(), quit_early: quitEarly })
        .eq("id", sessionId)
        .is("ended_at", null),
      "end session",
    );
  }

  async getAttempts(learnerId: string): Promise<AttemptRow[]> {
    return must(
      await this.db.from("task_attempts").select("*").eq("learner_id", learnerId).order("created_at").order("task_in_session"),
      "load attempts",
    ) as AttemptRow[];
  }

  async insertAttempt(a: NewAttempt): Promise<AttemptRow> {
    return must(await this.db.from("task_attempts").insert(a).select("*").single(), "insert attempt") as AttemptRow;
  }

  async updateAttempt(id: string, patch: Partial<AttemptRow>, expectedStep?: AttemptStep): Promise<AttemptRow | null> {
    let q = this.db.from("task_attempts").update(patch).eq("id", id);
    if (expectedStep) q = q.eq("step", expectedStep);
    return must(await q.select("*").maybeSingle(), "update attempt") as AttemptRow | null;
  }

  async markShown(id: string, field: "shown_at" | "feedback_shown_at", at: string): Promise<void> {
    must(await this.db.from("task_attempts").update({ [field]: at }).eq("id", id).is(field, null), "mark shown");
  }

  async readPosterior(): Promise<Posterior> {
    const rows = must(await this.db.from("bandit_state").select("arm, a, b"), "load bandit_state") as { arm: Arm; a: number; b: number }[];
    const p = {} as Posterior;
    for (const r of rows) p[r.arm] = { a: r.a, b: r.b };
    if (!p.plain || !p.hint || !p.example) throw new Error("bandit_state is missing an arm");
    return p;
  }

  async insertFeedbackDecision(d: Omit<FeedbackDecisionRow, "id" | "reward" | "bandit_updated">): Promise<FeedbackDecisionRow> {
    return must(await this.db.from("feedback_decisions").insert(d).select("*").single(), "insert decision") as FeedbackDecisionRow;
  }

  async getFeedbackDecision(attemptId: string): Promise<FeedbackDecisionRow | null> {
    return must(
      await this.db.from("feedback_decisions").select("*").eq("attempt_id", attemptId).maybeSingle(),
      "load decision",
    ) as FeedbackDecisionRow | null;
  }

  async finalizeFeedback(decisionId: string, reward: 0 | 1 | null, excluded: string | null, update: boolean): Promise<boolean> {
    return must(
      await this.db.rpc("finalize_feedback", { p_decision: decisionId, p_reward: reward, p_excluded: excluded, p_update: update }),
      "finalize_feedback",
    ) as boolean;
  }

  async insertAdaptiveDecision(d: AdaptiveDecisionRow): Promise<void> {
    must(await this.db.from("adaptive_decisions").insert(d), "insert adaptive decision");
  }

  async getAdaptiveDecision(attemptId: string, output: "reward" | "difficulty"): Promise<AdaptiveDecisionRow | null> {
    return must(
      await this.db.from("adaptive_decisions").select("*").eq("attempt_id", attemptId).eq("output", output).maybeSingle(),
      "load adaptive decision",
    ) as AdaptiveDecisionRow | null;
  }

  async hasConsent(learnerId: string, version: string): Promise<boolean> {
    const rows = must(
      await this.db.from("consents").select("kind").eq("learner_id", learnerId).eq("version", version),
      "load consents",
    ) as { kind: string }[];
    const kinds = new Set(rows.map((r) => r.kind));
    return kinds.has("parental_consent") && kinds.has("learner_assent");
  }

  async recordConsent(learnerId: string, version: string): Promise<void> {
    must(
      await this.db.from("consents").upsert(
        [
          { learner_id: learnerId, kind: "parental_consent", version },
          { learner_id: learnerId, kind: "learner_assent", version },
        ],
        { onConflict: "learner_id,kind,version", ignoreDuplicates: true },
      ),
      "record consent",
    );
  }

  async deleteLearnerData(userId: string): Promise<void> {
    must(await this.db.rpc("delete_learner_data", { p_user: userId }), "delete_learner_data");
  }

  llmLogger(sessionId: string): CallLogger {
    return async (row) => {
      const { data, error } = await this.db.from("llm_calls").insert({ ...row, session_id: sessionId }).select("id").single();
      if (error) {
        console.error("llm_calls insert failed", error.message);
        return null;
      }
      return (data as { id: string }).id;
    };
  }

  awardXp(userId: string, xp: number): Promise<XpAward> {
    return awardXp(this.db, userId, xp, this.now());
  }
}
