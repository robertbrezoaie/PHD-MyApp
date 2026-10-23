import { supabase } from "./supabase";

// ─── Types (mirror supabase/functions/_shared/engine/engine.ts) ──────────────

export type FeedbackKind = "plain" | "hint" | "example";

export type LearnFeedback = { kind: FeedbackKind; text: string | null };

export type LearnTask = {
  attempt_id: string;
  session_index: number;
  task_in_session: number;
  planned_tasks: number;
  prompt: string;
  step: "question" | "feedback";
  feedback: LearnFeedback | null;
  difficulty_explanation: string | null;
};

export type XpAward = {
  xp_gained: number;
  coins_gained: number;
  streak_days: number;
  level_up: boolean;
  new_level: number;
  new_badges: string[];
};

export type Completion = {
  solved: boolean;
  graded: boolean;
  multiplier: number;
  award: XpAward;
  reward_explanation: string | null;
  explanation: string;
  next: LearnTask | null;
};

export type AnswerResult =
  | { outcome: "correct" | "ungraded"; completion: Completion }
  | { outcome: "mistake"; feedback: LearnFeedback; task: LearnTask };

export type RetryResult = { outcome: "correct" | "incorrect" | "ungraded"; completion: Completion };

export type GradeBand = "lower" | "upper";

export type LearnerSettings = { grade_band: GradeBand | null; adaptive: boolean };

/** Engine error codes the screen reacts to (see EngineError). */
export class LearnError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

// ─── Edge Function: learn ────────────────────────────────────────────────────

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("learn", { body });
  if (error) {
    // FunctionsHttpError carries the response; the engine answers { error: code }
    const res = (error as { context?: Response }).context;
    const payload = res ? await res.json().catch(() => null) : null;
    throw new LearnError(payload?.error ?? error.message);
  }
  return data as T;
}

export const startSession = () => call<{ task: LearnTask | null }>({ action: "start" }).then((r) => r.task);
export const currentTask = () => call<{ task: LearnTask | null }>({ action: "current" }).then((r) => r.task);
export const submitFirstAnswer = (attemptId: string, text: string, dontKnow: boolean) =>
  call<AnswerResult>({ action: "answer", attempt_id: attemptId, text, dont_know: dontKnow });
export const submitRetry = (attemptId: string, text: string, dontKnow: boolean) =>
  call<RetryResult>({ action: "retry", attempt_id: attemptId, text, dont_know: dontKnow });
export const quitSession = () => call<{ ok: true }>({ action: "quit" });
export const giveConsent = () => call<{ ok: true }>({ action: "consent" });
export const deleteMyLearningData = () => call<{ ok: true }>({ action: "delete_data" });

// ─── Learner settings (RLS: own row, grade_band and adaptive only) ───────────

export async function getLearnerSettings(userId: string): Promise<LearnerSettings | null> {
  const { data } = await supabase.from("learners").select("grade_band, adaptive").eq("user_id", userId).maybeSingle();
  return (data as LearnerSettings | null) ?? null;
}

export async function updateLearnerSettings(userId: string, patch: Partial<LearnerSettings>): Promise<void> {
  // lib/database.types.ts does not match supabase-js's schema shape yet, so table types resolve to never
  const { error } = await supabase.from("learners").update(patch as never).eq("user_id", userId);
  if (error) throw error;
}

/** Grade choices at sign-up; only the band is stored (grades 4–8 = lower, otherwise upper). */
export const GRADE_CHOICES: { label: string; band: GradeBand }[] = [
  { label: "Grades 4–8", band: "lower" },
  { label: "Grades 9–12", band: "upper" },
  { label: "Not in school", band: "upper" },
];
