// Runs the real migrations on an in-process Postgres (PGlite), as pit-study does in tests/db.test.ts.
// A minimal stand-in for the Supabase auth schema and roles is created first.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { beforeAll, describe, expect, it } from 'vitest';

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  -- Supabase grants the API roles everything in public by default; RLS and explicit revokes do the rest
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const MIGRATIONS = [
  '20260327100035_initial_schema.sql',
  '20261023120000_adaptive_engine.sql',
  '20261023120100_bank_items_seed.sql',
  '20261023130000_data_protection.sql',
];

let pg: PGlite;

async function newUser(meta: Record<string, unknown> = {}): Promise<{ userId: string; learnerId: string }> {
  const u = await pg.query<{ id: string }>(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [
    `u${Math.random().toString(36).slice(2)}@example.com`,
    JSON.stringify(meta),
  ]);
  const l = await pg.query<{ learner_id: string }>(`select learner_id from public.learners where user_id = $1`, [u.rows[0].id]);
  return { userId: u.rows[0].id, learnerId: l.rows[0].learner_id };
}

async function seedDecision(learnerId: string, arm = 'hint'): Promise<string> {
  const s = await pg.query<{ id: string }>(
    `insert into public.learning_sessions (learner_id, session_index, planned_tasks, adaptive, grade_band, core_commit,
       prompt_version, grader_model, tutor_model)
     values ($1, (select coalesce(max(session_index), 0) + 1 from public.learning_sessions where learner_id = $1),
       12, true, 'upper', '05f70f7', 'v1', 'm', 'm') returning id`,
    [learnerId],
  );
  await pg.query(`update public.learning_sessions set ended_at = now() where id = $1`, [s.rows[0].id]);
  const a = await pg.query<{ id: string }>(
    `insert into public.task_attempts (learner_id, session_id, task_in_session, task_id, task_version, task_level,
       difficulty_used, e_used) values ($1, $2, 1, 'ALG-E1', 1, 3, 2, 0) returning id`,
    [learnerId, s.rows[0].id],
  );
  const d = await pg.query<{ id: string }>(
    `insert into public.feedback_decisions (attempt_id, half, arm, delivered_arm, propensity, propensities, thompson_probs,
       posterior_snapshot, tutor_status, core_commit)
     values ($1, 'random', $2, $2, 0.33, '{}', '{}', '{}', 'ok', '05f70f7') returning id`,
    [a.rows[0].id, arm],
  );
  return d.rows[0].id;
}

const bandit = async (arm: string) =>
  (await pg.query<{ a: number; b: number; n: number }>(`select a, b, n from public.bandit_state where arm = $1`, [arm])).rows[0];

beforeAll(async () => {
  pg = await PGlite.create({ extensions: { pgcrypto, uuid_ossp } });
  await pg.exec(SUPABASE_STUB);
  for (const f of MIGRATIONS) await pg.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'));
});

describe('migrations', () => {
  it('seeds the 62-question bank with levels 1/3/5', async () => {
    const r = await pg.query<{ level: number; n: number }>(
      `select level, count(*)::int as n from public.bank_items group by level order by level`,
    );
    expect(r.rows).toEqual([
      { level: 1, n: 10 },
      { level: 3, n: 26 },
      { level: 5, n: 26 },
    ]);
  });

  it('matches the copied JSON bank exactly', async () => {
    const json = JSON.parse(readFileSync('supabase/functions/_shared/domain/questions.json', 'utf8')) as {
      id: string;
      prompt_ro: string;
      rubric: unknown;
    }[];
    const r = await pg.query<{ id: string; prompt_ro: string; rubric: unknown }>(`select id, prompt_ro, rubric from public.bank_items`);
    const byId = new Map(r.rows.map((x) => [x.id, x]));
    for (const q of json) {
      expect(byId.get(q.id)?.prompt_ro).toBe(q.prompt_ro);
      expect(byId.get(q.id)?.rubric).toEqual(q.rubric);
    }
  });

  it('starts every bandit arm at Beta(1, 1)', async () => {
    for (const arm of ['plain', 'hint', 'example']) expect(await bandit(arm)).toEqual({ a: 1, b: 1, n: 0 });
  });

  it('creates a profile and a learner row on sign-up, with the grade band from the metadata', async () => {
    const withBand = await newUser({ username: 'kid1', grade_band: 'lower' });
    const noBand = await newUser({ username: 'kid2' });
    const bad = await newUser({ username: 'kid3', grade_band: '7' });
    const band = async (id: string) =>
      (await pg.query<{ grade_band: string | null }>(`select grade_band from public.learners where user_id = $1`, [id])).rows[0].grade_band;
    expect(await band(withBand.userId)).toBe('lower');
    expect(await band(noBand.userId)).toBeNull();
    expect(await band(bad.userId)).toBeNull();
    const p = await pg.query(`select 1 from public.profiles where id = $1`, [withBand.userId]);
    expect(p.rows.length).toBe(1);
  });

  it('gives each learner a pseudonymous id different from the auth id', async () => {
    const u = await newUser();
    expect(u.learnerId).not.toBe(u.userId);
  });

  it('allows only one open session per learner', async () => {
    const { learnerId } = await newUser({ grade_band: 'upper' });
    const insert = (i: number) =>
      pg.query(
        `insert into public.learning_sessions (learner_id, session_index, planned_tasks, adaptive, grade_band, core_commit,
           prompt_version, grader_model, tutor_model) values ($1, $2, 12, true, 'upper', 'c', 'v1', 'm', 'm')`,
        [learnerId, i],
      );
    await insert(1);
    await expect(insert(2)).rejects.toThrow();
  });
});

describe('finalize_feedback', () => {
  it('updates the bandit by (+r, +(1 - r)) exactly once', async () => {
    const { learnerId } = await newUser();
    const id = await seedDecision(learnerId, 'example');
    const before = await bandit('example');
    const first = await pg.query<{ ok: boolean }>(`select public.finalize_feedback($1, 1, null, true) as ok`, [id]);
    const again = await pg.query<{ ok: boolean }>(`select public.finalize_feedback($1, 1, null, true) as ok`, [id]);
    expect(first.rows[0].ok).toBe(true);
    expect(again.rows[0].ok).toBe(false);
    expect(await bandit('example')).toEqual({ a: before.a + 1, b: before.b, n: before.n + 1 });
  });

  it('records the outcome without touching the bandit when p_update is false', async () => {
    const { learnerId } = await newUser();
    const id = await seedDecision(learnerId, 'plain');
    const before = await bandit('plain');
    await pg.query(`select public.finalize_feedback($1, null, 'retry_grader_failed', false)`, [id]);
    expect(await bandit('plain')).toEqual(before);
    const d = await pg.query<{ excluded_reason: string; finalized: boolean }>(
      `select excluded_reason, finalized_at is not null as finalized from public.feedback_decisions where id = $1`,
      [id],
    );
    expect(d.rows[0]).toEqual({ excluded_reason: 'retry_grader_failed', finalized: true });
    // a later call cannot turn the failed retry into a bandit update
    const again = await pg.query<{ ok: boolean }>(`select public.finalize_feedback($1, 1, null, true) as ok`, [id]);
    expect(again.rows[0].ok).toBe(false);
    expect(await bandit('plain')).toEqual(before);
  });
});

describe('access from the app (RLS)', () => {
  async function asUser<T>(userId: string, sql: string, params: unknown[] = []): Promise<T[]> {
    return pg.transaction(async (tx) => {
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
      await tx.query(`set local role authenticated`);
      return (await tx.query<T>(sql, params)).rows;
    });
  }

  it('lets a learner read only their own learner row', async () => {
    const a = await newUser({ grade_band: 'lower' });
    await newUser({ grade_band: 'upper' });
    const rows = await asUser<{ user_id: string }>(a.userId, `select user_id from public.learners`);
    expect(rows.map((r) => r.user_id)).toEqual([a.userId]);
  });

  it('lets a learner change their grade band and opt-out, but not their pseudonymous id', async () => {
    const a = await newUser();
    await asUser(a.userId, `update public.learners set grade_band = 'upper', adaptive = false where user_id = $1`, [a.userId]);
    const r = await pg.query<{ grade_band: string; adaptive: boolean }>(`select grade_band, adaptive from public.learners where user_id = $1`, [
      a.userId,
    ]);
    expect(r.rows[0]).toEqual({ grade_band: 'upper', adaptive: false });
    await expect(
      asUser(a.userId, `update public.learners set learner_id = gen_random_uuid() where user_id = $1`, [a.userId]),
    ).rejects.toThrow(/permission denied/);
  });

  it('hides the bank, the logs and the bandit state from the app', async () => {
    const a = await newUser();
    for (const t of ['bank_items', 'learning_sessions', 'task_attempts', 'feedback_decisions', 'adaptive_decisions', 'bandit_state', 'llm_calls']) {
      expect(await asUser(a.userId, `select * from public.${t}`), t).toEqual([]);
    }
  });

  it('does not let the app call finalize_feedback', async () => {
    const a = await newUser();
    const id = await seedDecision(a.learnerId);
    await expect(asUser(a.userId, `select public.finalize_feedback($1, 1, null, true)`, [id])).rejects.toThrow(/permission denied/);
  });
});

describe('data protection (section 10)', () => {
  it('deletes every learning row of a learner and gives them a new pseudonym', async () => {
    const u = await newUser({ grade_band: 'upper' });
    const d = await seedDecision(u.learnerId);
    await pg.query(`insert into public.consents (learner_id, kind, version) values ($1, 'parental_consent', 'v1')`, [u.learnerId]);
    await pg.query(`select public.delete_learner_data($1)`, [u.userId]);
    for (const [table, col] of [
      ['learning_sessions', 'learner_id'],
      ['task_attempts', 'learner_id'],
      ['consents', 'learner_id'],
    ]) {
      const r = await pg.query(`select 1 from public.${table} where ${col} = $1`, [u.learnerId]);
      expect(r.rows, table).toHaveLength(0);
    }
    expect((await pg.query(`select 1 from public.feedback_decisions where id = $1`, [d])).rows).toHaveLength(0);
    const fresh = await pg.query<{ learner_id: string; grade_band: string | null }>(
      `select learner_id, grade_band from public.learners where user_id = $1`,
      [u.userId],
    );
    expect(fresh.rows[0].learner_id).not.toBe(u.learnerId);
    expect(fresh.rows[0].grade_band).toBeNull();
    // the profile (XP, coins, badges) is not learning data and stays
    expect((await pg.query(`select 1 from public.profiles where id = $1`, [u.userId])).rows).toHaveLength(1);
  });

  it('purges sessions that started before the cutoff, with their attempts', async () => {
    const u = await newUser();
    await seedDecision(u.learnerId);
    await pg.query(`update public.learning_sessions set started_at = '2020-01-01' where learner_id = $1`, [u.learnerId]);
    const r = await pg.query<{ n: number }>(`select public.purge_learning_data('2021-01-01') as n`);
    expect(r.rows[0].n).toBeGreaterThanOrEqual(1);
    expect((await pg.query(`select 1 from public.task_attempts where learner_id = $1`, [u.learnerId])).rows).toHaveLength(0);
  });

  it('shows nicknames, not usernames, and no uploaded photos on the leaderboard', async () => {
    const u = await newUser({ username: 'maria.popescu', avatar_url: 'https://x.supabase.co/storage/v1/object/public/avatars/a/avatar.jpg' });
    const e = await newUser({ username: 'ion', avatar_url: 'emoji:🦊' });
    const lb = await pg.query<{ id: string; username: string; avatar_url: string | null }>(`select id, username, avatar_url from public.leaderboard`);
    const row = lb.rows.find((r) => r.id === u.userId)!;
    expect(row.username).not.toBe('maria.popescu');
    expect(row.username).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d{2}$/);
    expect(row.avatar_url).toBeNull();
    expect(lb.rows.find((r) => r.id === e.userId)!.avatar_url).toBe('emoji:🦊');
  });

  it('does not let the app call the deletion or retention functions', async () => {
    const u = await newUser();
    await expect(
      pg.transaction(async (tx) => {
        await tx.query(`set local role authenticated`);
        await tx.query(`select public.delete_learner_data($1)`, [u.userId]);
      }),
    ).rejects.toThrow(/permission denied/);
  });
});
