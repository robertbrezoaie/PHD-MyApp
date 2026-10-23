// Adaptive learning sessions (LEARNSPACE_RESEARCH_UPDATE.md). One function, several actions:
//   start        resume the open session or start the next one          -> { task }
//   current      the current task of the open session, or null          -> { task }
//   answer       first answer to a task                                  -> AnswerResult
//   retry        answer after feedback                                   -> RetryResult
//   quit         end the open session early                              -> { ok }
//   consent      record parental consent and learner assent              -> { ok }
//   delete_data  delete every learning row of this learner (on request)  -> { ok }

import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { config } from "../_shared/config/config.ts";
import { Engine, EngineError } from "../_shared/engine/engine.ts";
import { env } from "../_shared/llm/env.ts";
import { secureRng } from "../_shared/rng.ts";
import { SupabaseStore } from "./store.ts";

const MAX_ANSWER_CHARS = 2000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = () => new Date();
    const store = new SupabaseStore(
      serviceClient,
      {
        core_commit: config.app.core_commit,
        prompt_version: env.promptVersion,
        grader_model: env.graderModel,
        tutor_model: env.tutorModel,
      },
      now,
    );
    const engine = new Engine({ store, config, rng: secureRng, now, promptVersion: env.promptVersion });

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const text = typeof body.text === "string" ? body.text.slice(0, MAX_ANSWER_CHARS) : "";
    const dontKnow = body.dont_know === true;
    const attemptId = typeof body.attempt_id === "string" ? body.attempt_id : "";

    switch (action) {
      case "start":
        return json({ task: await engine.start(user.id) });
      case "current":
        return json({ task: await engine.current(user.id) });
      case "answer":
        if (!attemptId) return json({ error: "attempt_id is required" }, 400);
        return json(await engine.answer(user.id, attemptId, text, dontKnow));
      case "retry":
        if (!attemptId) return json({ error: "attempt_id is required" }, 400);
        return json(await engine.retry(user.id, attemptId, text, dontKnow));
      case "quit":
        await engine.quit(user.id);
        return json({ ok: true });
      case "consent":
        await engine.consent(user.id);
        return json({ ok: true });
      case "delete_data":
        await engine.deleteMyData(user.id);
        return json({ ok: true });
      default:
        return json({ error: `unknown action ${action}` }, 400);
    }
  } catch (err) {
    if (err instanceof EngineError) return json({ error: err.code }, err.status);
    console.error("learn failed", err);
    return json({ error: String(err) }, 500);
  }
});
