-- ============================================================
-- ADAPTIVE ENGINE (LEARNSPACE_RESEARCH_UPDATE.md sections 4, 8, 10)
-- Additive only: no existing table or column is changed or dropped.
-- Every table below is written by Edge Functions with the service role.
-- RLS is on everywhere; clients may only read and edit their own learner settings.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Learners: the pseudonymous id used in every log table (section 10.5).
-- The link to auth.users lives only here.
-- ------------------------------------------------------------
create table public.learners (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  learner_id  uuid not null unique default gen_random_uuid(),
  grade_band  text check (grade_band in ('lower', 'upper')),  -- null until asked; lower = grades 4-8
  adaptive    boolean not null default true,                  -- false = opt-out of adaptation (section 10.8)
  created_at  timestamptz not null default now()
);

alter table public.learners enable row level security;

create policy "Learners can view own settings"
  on public.learners for select using (auth.uid() = user_id);

create policy "Learners can update own settings"
  on public.learners for update using (auth.uid() = user_id);

-- only these two columns are editable from the app
revoke update on public.learners from anon, authenticated;
grant update (grade_band, adaptive) on public.learners to authenticated;

-- ------------------------------------------------------------
-- Question bank (copied from pit-study seed/questions.json, freeze-v1).
-- Reference answers and rubrics never reach the client: no policies.
-- ------------------------------------------------------------
create table public.bank_items (
  id                  text primary key,
  domain              text not null check (domain in ('algorithms','data','worlds','web','ai')),
  tier                text not null check (tier in ('warmup','easy','hard')),
  level               smallint not null check (level between 1 and 5),
  bands               text[] not null default '{lower,upper}',
  prompt_ro           text not null,
  reference_answer_ro text not null,
  rubric              jsonb not null,
  misconceptions      jsonb not null default '[]',
  explanation_ro      text not null,
  active              boolean not null default true,
  version             int not null default 1
);

alter table public.bank_items enable row level security;

-- ------------------------------------------------------------
-- Sessions: 12 planned tasks each (config app.planned_tasks).
-- ------------------------------------------------------------
create table public.learning_sessions (
  id                   uuid primary key default gen_random_uuid(),
  learner_id           uuid not null references public.learners(learner_id) on delete cascade,
  session_index        int not null check (session_index >= 1),
  planned_tasks        int not null check (planned_tasks >= 1),
  absent_slots_before  int not null default 0,   -- activity slots of 0 for missed sessions (section 5, e)
  adaptive             boolean not null,         -- learner setting when the session started
  grade_band           text not null check (grade_band in ('lower', 'upper')),
  started_at           timestamptz not null default now(),
  ended_at             timestamptz,
  quit_early           boolean not null default false,
  core_commit          text not null,
  prompt_version       text not null,
  grader_model         text not null,
  tutor_model          text not null,
  unique (learner_id, session_index)
);
create unique index learning_sessions_one_open on public.learning_sessions (learner_id) where ended_at is null;

alter table public.learning_sessions enable row level security;

-- ------------------------------------------------------------
-- LLM calls (same shape as pit-study llm_calls).
-- ------------------------------------------------------------
create table public.llm_calls (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid references public.learning_sessions(id) on delete cascade,
  purpose        text not null check (purpose in ('grade','hint','example')),
  provider       text not null,
  model          text not null,
  prompt_version text not null,
  request        jsonb not null,
  response_text  text,
  parsed         jsonb,
  status         text not null check (status in ('ok','invalid_json','timeout','error')),
  attempt        int not null default 1,
  latency_ms     int,
  input_tokens   int,
  output_tokens  int,
  created_at     timestamptz not null default now()
);
create index llm_calls_session on public.llm_calls (session_id);

alter table public.llm_calls enable row level security;

-- ------------------------------------------------------------
-- Task attempts: one row per task (section 4).
-- step: 'question' (waiting for the first answer) -> 'feedback' (waiting for the retry) -> 'done';
--       'quit' when the session ended before the task was finished.
-- ------------------------------------------------------------
create table public.task_attempts (
  id                    uuid primary key default gen_random_uuid(),
  learner_id            uuid not null references public.learners(learner_id) on delete cascade,
  session_id            uuid not null references public.learning_sessions(id) on delete cascade,
  task_in_session       int not null check (task_in_session >= 1),
  task_id               text not null references public.bank_items(id),
  task_version          int not null,
  task_level            smallint not null check (task_level between 1 and 5),
  difficulty_used       double precision not null check (difficulty_used between 1 and 5),  -- D_t
  e_used                double precision not null,  -- e_{t-1}, the input of D_t
  step                  text not null default 'question' check (step in ('question','feedback','done','quit')),
  created_at            timestamptz not null default now(),
  shown_at              timestamptz,               -- first time the question was served
  first_answer_at       timestamptz,
  rt_ms                 int,
  first_answer_text     text,
  first_score           int check (first_score between 0 and 3),
  first_grader_status   text check (first_grader_status in ('ok','deterministic','failed')),
  first_misconception   text,
  first_correct         boolean,
  dont_know             boolean,
  feedback_arm          text check (feedback_arm in ('plain','hint','example')),
  feedback_shown_at     timestamptz,
  retry_answer_at       timestamptz,
  retry_answer_text     text,
  retry_score           int check (retry_score between 0 and 3),
  retry_grader_status   text check (retry_grader_status in ('ok','deterministic','failed')),
  retry_correct         boolean,
  retry_dont_know       boolean,
  multiplier            double precision,
  xp_awarded            int,
  u                     double precision,          -- signals after the task (incl. retry)
  b                     double precision,
  e                     double precision,
  completed_at          timestamptz,
  unique (session_id, task_in_session)
);
create index task_attempts_learner on public.task_attempts (learner_id, created_at);

alter table public.task_attempts enable row level security;

-- ------------------------------------------------------------
-- Bandit: one global Beta state per arm for MyApp (separate from pit-study's study database).
-- ------------------------------------------------------------
create table public.bandit_state (
  arm        text primary key check (arm in ('plain','hint','example')),
  a          int not null default 1,
  b          int not null default 1,
  n          int not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.bandit_state (arm) values ('plain'), ('hint'), ('example');

alter table public.bandit_state enable row level security;

-- ------------------------------------------------------------
-- Feedback decisions: one row per mistake, with propensities (section 8).
-- ------------------------------------------------------------
create table public.feedback_decisions (
  id                 uuid primary key default gen_random_uuid(),
  attempt_id         uuid not null unique references public.task_attempts(id) on delete cascade,
  half               text not null check (half in ('random','thompson')),
  arm                text not null check (arm in ('plain','hint','example')),        -- assigned
  delivered_arm      text not null check (delivered_arm in ('plain','hint','example')),
  propensity         double precision not null,
  propensities       jsonb not null,
  thompson_probs     jsonb not null,
  posterior_snapshot jsonb not null,
  tutor_status       text not null check (tutor_status in ('ok','regenerated_ok','leak_suspected','failed','not_needed')),
  feedback_text      text,
  llm_call_id        uuid references public.llm_calls(id),
  reward             int check (reward in (0, 1)),   -- filled after the graded retry
  bandit_updated     boolean not null default false,
  excluded_reason    text,
  finalized_at       timestamptz,                -- set once, when the retry outcome is recorded
  core_commit        text not null,
  created_at         timestamptz not null default now()
);

alter table public.feedback_decisions enable row level security;

-- Records the retry reward and, when p_update is true, updates the bandit in the same transaction.
-- Returns false when the reward was already recorded, so a duplicate request never updates twice.
-- Adapted from pit-study finalize_retry().
create function public.finalize_feedback(p_decision uuid, p_reward int, p_excluded text, p_update boolean)
returns boolean
language plpgsql as $$
declare
  v_arm text;
begin
  update public.feedback_decisions
     set reward = p_reward,
         excluded_reason = coalesce(excluded_reason, p_excluded),
         bandit_updated = p_update,
         finalized_at = now()
   where id = p_decision and finalized_at is null
   returning arm into v_arm;
  if not found then
    return false;
  end if;
  if p_update then
    update public.bandit_state
       set a = a + p_reward, b = b + (1 - p_reward), n = n + 1, updated_at = now()
     where arm = v_arm;
  end if;
  return true;
end;
$$;

revoke execute on function public.finalize_feedback(uuid, int, text, boolean) from public, anon, authenticated;

-- ------------------------------------------------------------
-- Adaptive decisions: one row per output per task (section 4).
-- The reward row belongs to the task it rewards; the difficulty row to the task whose D_t it set.
-- ------------------------------------------------------------
create table public.adaptive_decisions (
  id                 uuid primary key default gen_random_uuid(),
  attempt_id         uuid not null references public.task_attempts(id) on delete cascade,
  output             text not null check (output in ('reward','difficulty')),
  delta              double precision,           -- aiReward, or the planned difficulty step
  contributions      jsonb,
  multiplier         double precision,
  difficulty         double precision,
  clipped            boolean,
  suppressed_by_clip boolean not null default false,
  explained          boolean not null,
  factors            text[],
  shares             numeric[],
  text               text,
  created_at         timestamptz not null default now(),
  unique (attempt_id, output)
);

alter table public.adaptive_decisions enable row level security;

-- ------------------------------------------------------------
-- New users: create the learner row, with the grade band chosen at sign-up.
-- Same function as the initial schema, plus the learners insert.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into public.learners (user_id, grade_band)
  values (
    new.id,
    case when new.raw_user_meta_data->>'grade_band' in ('lower', 'upper')
         then new.raw_user_meta_data->>'grade_band' end
  );
  return new;
end;
$$;

-- Existing users get a learner row; they are asked for their grade before their first session.
insert into public.learners (user_id)
select id from auth.users
on conflict (user_id) do nothing;
