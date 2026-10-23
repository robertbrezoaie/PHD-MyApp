-- ============================================================
-- DATA PROTECTION (LEARNSPACE_RESEARCH_UPDATE.md section 10)
-- Additive: no data is dropped. The avatar bucket and uploaded photos are NOT touched here;
-- removing them needs Robert's approval (section 0, rule 3).
-- ============================================================

-- ------------------------------------------------------------
-- Consent (10.6): parental consent and learner assent, with text version and time.
-- ------------------------------------------------------------
create table public.consents (
  id          uuid primary key default gen_random_uuid(),
  learner_id  uuid not null references public.learners(learner_id) on delete cascade,
  kind        text not null check (kind in ('parental_consent', 'learner_assent')),
  version     text not null,
  given_at    timestamptz not null default now(),
  unique (learner_id, kind, version)
);

alter table public.consents enable row level security;

-- ------------------------------------------------------------
-- Deletion on request (10.7): removes the learner row; sessions, attempts, decisions,
-- explanations, LLM calls and consents go with it (on delete cascade). The learner gets
-- a new pseudonymous id and is asked for their grade band again.
-- The shared bandit_state keeps its counts: they are aggregates without a learner reference.
-- ------------------------------------------------------------
create function public.delete_learner_data(p_user uuid)
returns void
language plpgsql as $$
begin
  delete from public.learners where user_id = p_user;
  insert into public.learners (user_id) values (p_user);
end;
$$;

revoke execute on function public.delete_learner_data(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- Retention (10.7): learning data is kept for the duration of the course.
-- Removes every session that started before p_cutoff, with its attempts, decisions and LLM calls.
-- Run it at the end of a course; it is not scheduled because the course end date is not fixed.
-- ------------------------------------------------------------
create function public.purge_learning_data(p_cutoff timestamptz)
returns int
language plpgsql as $$
declare
  v_count int;
begin
  delete from public.learning_sessions where started_at < p_cutoff;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.purge_learning_data(timestamptz) from public, anon, authenticated;

-- ------------------------------------------------------------
-- Pseudonyms in shared views (10.4): the leaderboard shows a generated nickname,
-- never the username (which defaults to the e-mail prefix), and no uploaded photos.
-- ------------------------------------------------------------
alter table public.profiles add column nickname text;

create function public.generate_nickname()
returns text
language sql volatile as $$
  select (array['Penguin','Fox','Dolphin','Dragon','Llama','Panda','Koala','Chameleon','Hedgehog','Shark',
                'Tiger','Wolf','Pony','Snail','Hamster','Capybara','Axolotl','Flamingo','Rabbit','Elephant',
                'Pelican','Parrot','Lion','Bear','Badger','Beaver','Jaguar','Kangaroo','Zebra','Octopus'])[1 + floor(random() * 30)::int]
      || (array['Turbo','Ninja','Pixel','Laser','Bolt','Meteor','Robot','Vortex','Nitro','Glitch',
                'Byte','Neon','Radar','Cosmos','Magnet','Tornado','Galaxy','Comet','Rocket','Zoom'])[1 + floor(random() * 20)::int]
      || (10 + floor(random() * 90)::int)::text
$$;

update public.profiles set nickname = public.generate_nickname() where nickname is null;
alter table public.profiles alter column nickname set default public.generate_nickname();
alter table public.profiles alter column nickname set not null;

-- same columns as before, so the app keeps working; username now carries the nickname
create or replace view public.leaderboard as
  select
    id,
    nickname as username,
    case when avatar_url like '%/storage/v1/object/public/avatars/%' then null else avatar_url end as avatar_url,
    points,
    level,
    rank() over (order by points desc) as rank
  from public.profiles
  order by points desc
  limit 100;
