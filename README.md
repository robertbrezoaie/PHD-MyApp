# LearnSpace

[![CI](https://github.com/robertbrezoaie/PHD-MyApp/actions/workflows/ci.yml/badge.svg)](https://github.com/robertbrezoaie/PHD-MyApp/actions/workflows/ci.yml)

LearnSpace is a gamified mobile learning app with an adaptive, explainable AI layer. It is the prototype of the framework in
*“An Explainable Hybrid AI–Gamification Framework for Adaptive E-Learning Systems with Simulation-Based Validation”*
(revised manuscript, MDPI *Algorithms*). The framework's algorithms were validated in simulation in
[learnspace-sim](https://github.com/robertbrezoaie/learnspace-sim); this app runs the same code.

The app is built with React Native (Expo) and Supabase (PostgreSQL, Edge Functions on Deno). Answers are graded and hints
are written by an LLM (Mistral).

## What the adaptive layer does

A learner works through practice sessions of 12 open questions. For each question:

1. **The answer is graded** on a 0–3 rubric by the LLM grader; a score of 2 or more counts as correct. A learner can also press *I don't know*.
2. **After a mistake, a feedback allocator chooses the help**: a plain “not yet”, a hint, or a worked example. It is a Thompson-sampling bandit with a 50% uniform-random share, so every option keeps a probability of at least 1/6 and its effect can be estimated without bias later. The learner then tries again, and the retry outcome updates the bandit.
3. **XP is modulated** by the learner's signals: mastery *u*, response behaviour *b* (response times against the learner's own history) and engagement change *e*, each in [−1, 1]. aiReward = 0.4u + 0.4b + 0.2e; the XP multiplier is clip(1 + 0.5·aiReward, 0.75, 1.5).
4. **The next question's difficulty** follows the curriculum (levels 2 → 4 over 20 sessions) adjusted by engagement change (DDA-E): D = clip(D_base · (1 + e), 1, 5).
5. **The learner sees why.** Every reward or difficulty change of at least 0.10 is explained in one sentence, built only from the factors that actually drove that decision and point in its direction, for example *“You earned extra XP because your mastery of the topic keeps growing and you are working more fluently than usual.”*

All inputs come from interaction logs only: no biometric, photo or location data. Every decision is logged with its inputs,
and every feedback choice with its propensities.

## Where the paper's algorithms are

| Paper | Code |
|---|---|
| Signals u, b, e (Section 3.1) | [`_shared/core/signals.ts`](supabase/functions/_shared/core/signals.ts) |
| XP, formula (1) | [`_shared/core/gamification.ts`](supabase/functions/_shared/core/gamification.ts) |
| Reward modulation, formula (3) | [`_shared/core/reward.ts`](supabase/functions/_shared/core/reward.ts) |
| DDA-E, formula (4) | [`_shared/core/difficulty.ts`](supabase/functions/_shared/core/difficulty.ts) |
| Feedback allocator, formula (5) (Section 3.3) | [`_shared/core/bandit/`](supabase/functions/_shared/core/bandit/) |
| Explanation Layer and templates (Section 3.4, Table 3) | [`_shared/core/explain.ts`](supabase/functions/_shared/core/explain.ts), [`templates.ts`](supabase/functions/_shared/core/templates.ts) |
| Parameters (Section 3) | [`_shared/config/algorithm.default.json`](supabase/functions/_shared/config/algorithm.default.json) |

`supabase/functions/_shared/core/` is copied **unchanged** from learnspace-sim tag `v1.0` (commit `05f70f7`).
[`PROVENANCE.json`](supabase/functions/_shared/core/PROVENANCE.json) records the SHA-256 of every source file, and a test fails
if any copied file differs from it. The app's own settings (12 tasks per session, 20 sessions, Monte Carlo propensities) are in
[`algorithm.app.json`](supabase/functions/_shared/config/algorithm.app.json).

## Architecture

The code follows the four components of an intelligent tutoring system.

| Component | Folder | Contents |
|---|---|---|
| Domain model | [`_shared/domain/`](supabase/functions/_shared/domain/) | 62 questions in five areas (algorithms, data, 3D worlds, web, AI), each with a rubric, reference answer, misconceptions and explanation; difficulty levels 1/3/5 |
| Learner model | [`_shared/learner/`](supabase/functions/_shared/learner/) | Rebuilds u, b, e from the logs, including missed and quit sessions |
| Pedagogical model | [`_shared/pedagogy/`](supabase/functions/_shared/pedagogy/), [`_shared/core/bandit/`](supabase/functions/_shared/core/bandit/) | Outer loop: next question by difficulty. Inner loop: feedback allocator and LLM tutor, with a check that a hint does not give the answer away |
| Grading | [`_shared/grading/`](supabase/functions/_shared/grading/) | LLM grader; it sees only the question, rubric and answer, never the attempt number or the feedback given |
| Explanations | [`_shared/explain/`](supabase/functions/_shared/explain/) | Which decisions are explained and when |
| Interface | [`app/`](app/), [`components/`](components/) | Expo app; the practice session is [`app/session.tsx`](app/session.tsx) |

[`_shared/engine/engine.ts`](supabase/functions/_shared/engine/engine.ts) runs one session and reaches storage only through
the `Store` interface in [`store.ts`](supabase/functions/_shared/engine/store.ts). The Edge Function
[`learn`](supabase/functions/learn/) implements that interface with Supabase; the tests use an in-memory store. The engine can
therefore move to a separate service without changes; the app talks to it only through [`lib/learn.ts`](lib/learn.ts).

## Data protection

- Logs use a pseudonymous learner ID; the link to the account exists in one access-restricted table.
- Parental consent and the learner's assent are recorded, with the text version, before the first session.
- Learners can opt out of adaptation (fixed difficulty, no XP bonus, plain feedback) and delete all their learning data.
- Leaderboards show generated nicknames only. Photo upload was removed; avatars are emoji or generated images.
- Row-level security is on for every table. The app can read only its own settings; logs, the question bank and the bandit state are reachable only from Edge Functions.

The schema is in [`supabase/migrations/`](supabase/migrations/).

## Tests

```bash
npm test                     # 129 tests (Vitest)
npm run typecheck:engine     # strict TypeScript for the engine, tests and scripts
npm run typecheck:functions  # Deno type check of the learn Edge Function
npx tsc --noEmit             # the app
npm run lint
```

| Folder | Covers |
|---|---|
| [`tests/core/`](tests/core/) | learnspace-sim's own tests for the core, ported unchanged, plus the provenance and purity checks |
| [`tests/app/`](tests/app/) | The paper's worked examples (Table 4), invariants (ranges, propensities ≥ 1/6, explanations never name a factor that worked against the decision), cold start, question selection, and whole scripted sessions through the engine |
| [`tests/study/`](tests/study/) | Grader, tutor, question bank and LLM adapter |
| [`tests/db/`](tests/db/) | The real migrations on an in-process PostgreSQL (PGlite): row-level security, the atomic bandit update, deletion and retention |

## Running the app

Requirements: Node 20+, a Supabase project, and a Mistral API key.

```bash
npm install
cp .env.example .env.local   # then fill in the two values
npx expo start
```

Backend (Supabase CLI, project linked with `supabase link`):

```bash
supabase db push
supabase secrets set LLM_PROVIDER=openai_compatible LLM_BASE_URL=https://api.mistral.ai/v1 LLM_JSON_MODE=true \
  LLM_MODEL_GRADER=mistral-medium-2604 LLM_MODEL_TUTOR=mistral-medium-2604 LLM_API_KEY=<key>
supabase functions deploy learn --use-api
npm run gen:types            # regenerate lib/database.generated.ts after schema changes
```

## Repository layout

```
app/                      Expo Router screens (tabs, practice session, quests, shop, courses, login)
components/               Shared UI
lib/                      Supabase client, API helpers, theme, generated database types
supabase/
  functions/_shared/      Adaptive engine (see Architecture)
  functions/learn/        Edge Function for practice sessions
  functions/…             Answer submission, energy, FreshLearn course sync
  migrations/             Database schema
scripts/                  Question-bank seed generator, cron-secret rotation
tests/                    Vitest suites
```

## Status

A research prototype. The adaptive engine is planned to move into a separate service that the app calls.
