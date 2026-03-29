-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null,
  avatar_url   text,
  xp           integer not null default 0,
  level        integer not null default 1,
  points       integer not null default 0,
  coins        integer not null default 0,
  energy       integer not null default 100,
  streak_days  integer not null default 0,
  last_active_date date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view all profiles"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- ============================================================
-- BADGES (global definitions)
-- ============================================================
create table public.badges (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  description      text,
  icon             text not null,
  condition_type   text not null, -- 'xp_total' | 'streak_days' | 'quests_completed' | 'level'
  condition_value  integer not null
);

alter table public.badges enable row level security;

create policy "Anyone can view badges"
  on public.badges for select using (true);

-- ============================================================
-- USER BADGES (earned badges)
-- ============================================================
create table public.user_badges (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles(id) on delete cascade,
  badge_id  uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique(user_id, badge_id)
);

alter table public.user_badges enable row level security;

create policy "Users can view all user badges"
  on public.user_badges for select using (true);

create policy "Service role can insert user badges"
  on public.user_badges for insert with check (true);

-- ============================================================
-- QUESTS (global definitions)
-- ============================================================
create type quest_tier as enum ('bronze', 'silver', 'gold', 'diamond');

create table public.quests (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  tier         quest_tier not null default 'bronze',
  xp_required  integer not null default 100,
  xp_reward    integer not null default 500,
  coin_reward  integer not null default 25,
  created_at   timestamptz not null default now()
);

alter table public.quests enable row level security;

create policy "Anyone can view quests"
  on public.quests for select using (true);

-- ============================================================
-- USER QUESTS (progress per user)
-- ============================================================
create table public.user_quests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  quest_id     uuid not null references public.quests(id) on delete cascade,
  xp_progress  integer not null default 0,
  completed    boolean not null default false,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  unique(user_id, quest_id)
);

alter table public.user_quests enable row level security;

create policy "Users can view own quest progress"
  on public.user_quests for select using (auth.uid() = user_id);

create policy "Service role can manage user quests"
  on public.user_quests for all using (true);

-- ============================================================
-- QUESTIONS (linked to quests)
-- ============================================================
create table public.questions (
  id         uuid primary key default gen_random_uuid(),
  quest_id   uuid not null references public.quests(id) on delete cascade,
  prompt     text not null,
  hint       text,
  xp_reward  integer not null default 20,
  order_num  integer not null default 1
);

alter table public.questions enable row level security;

create policy "Anyone can view questions"
  on public.questions for select using (true);

-- ============================================================
-- USER ANSWERS
-- ============================================================
create table public.user_answers (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  question_id  uuid not null references public.questions(id) on delete cascade,
  answer_text  text not null,
  submitted_at timestamptz not null default now(),
  unique(user_id, question_id)
);

alter table public.user_answers enable row level security;

create policy "Users can view own answers"
  on public.user_answers for select using (auth.uid() = user_id);

create policy "Users can insert own answers"
  on public.user_answers for insert with check (auth.uid() = user_id);

-- ============================================================
-- TASKS (daily tasks, global definitions)
-- ============================================================
create table public.tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  xp_reward  integer not null default 30,
  is_daily   boolean not null default true
);

alter table public.tasks enable row level security;

create policy "Anyone can view tasks"
  on public.tasks for select using (true);

-- ============================================================
-- USER TASKS (daily completion tracking)
-- ============================================================
create table public.user_tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  task_id      uuid not null references public.tasks(id) on delete cascade,
  completed    boolean not null default false,
  completed_at timestamptz,
  task_date    date not null default current_date,
  unique(user_id, task_id, task_date)
);

alter table public.user_tasks enable row level security;

create policy "Users can view own task completions"
  on public.user_tasks for select using (auth.uid() = user_id);

create policy "Users can insert own task completions"
  on public.user_tasks for insert with check (auth.uid() = user_id);

create policy "Users can update own task completions"
  on public.user_tasks for update using (auth.uid() = user_id);

-- ============================================================
-- LEADERBOARD VIEW
-- ============================================================
create view public.leaderboard as
  select
    id,
    username,
    avatar_url,
    points,
    level,
    rank() over (order by points desc) as rank
  from public.profiles
  order by points desc
  limit 100;

-- ============================================================
-- HELPER: auto-update updated_at on profiles
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- HELPER: auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- SEED: badges
-- ============================================================
insert into public.badges (name, description, icon, condition_type, condition_value) values
  ('XP Master',      'Earn 1000 total XP',       'trophy-outline',          'xp_total',          1000),
  ('World Explorer', 'Complete 5 quests',         'ghost-outline',           'quests_completed',  5),
  ('Daily Streak',   'Maintain a 7-day streak',   'fire',                    'streak_days',       7),
  ('Quiz King',      'Answer 20 questions',       'medal-outline',           'answers_submitted', 20),
  ('Level Up',       'Reach level 5',             'arrow-up-circle-outline', 'level',             5);

-- ============================================================
-- SEED: quests
-- ============================================================
insert into public.quests (title, description, tier, xp_required, xp_reward, coin_reward) values
  ('Master React Hooks',   'Learn all core React hooks through practice',     'gold',    100, 1500, 50),
  ('CSS Grid Master',      'Complete all CSS Grid layout challenges',          'silver',  100, 1200, 40),
  ('JS Fundamentals',      'Solidify your JavaScript foundations',             'bronze',  80,  800,  25),
  ('TypeScript Pro',       'Understand TypeScript generics and utility types', 'diamond', 150, 2000, 75);

-- ============================================================
-- SEED: questions
-- ============================================================
insert into public.questions (quest_id, prompt, hint, xp_reward, order_num)
select q.id,
  'Explain the primary purpose of the `useState` hook in React and provide a simple code example.',
  'Think about managing component-specific data.',
  20, 1
from public.quests q where q.title = 'Master React Hooks';

insert into public.questions (quest_id, prompt, hint, xp_reward, order_num)
select q.id,
  'What is the difference between `useEffect` with no dependency array vs an empty dependency array?',
  'Think about when the effect runs in each case.',
  25, 2
from public.quests q where q.title = 'Master React Hooks';

insert into public.questions (quest_id, prompt, hint, xp_reward, order_num)
select q.id,
  'Create a CSS Grid layout with 3 columns where the middle column is twice as wide as the others.',
  'Think about fr units.',
  20, 1
from public.quests q where q.title = 'CSS Grid Master';

-- ============================================================
-- SEED: daily tasks
-- ============================================================
insert into public.tasks (title, xp_reward, is_daily) values
  ('Complete Module 3 Quiz',     50, true),
  ('Review JavaScript Basics',   30, true),
  ('Practice Math Equations',    40, true),
  ('Read about Quantum Physics', 60, true);
