-- ============================================================
-- LOCK THE FRESHLEARN TABLES (data exposure found 2026-10-26)
-- The policies "service role full access" had no role restriction (using (true)), so anyone with the
-- public anon key could read freshlearn_members (names, e-mails, phones, cities) and freshlearn_completions.
-- The FreshLearn Edge Functions use the service role, which bypasses RLS and needs no policy.
-- ============================================================

drop policy if exists "service role full access" on public.freshlearn_members;
drop policy if exists "service role full access" on public.freshlearn_completions;

revoke all on public.freshlearn_members from anon, authenticated;
revoke all on public.freshlearn_completions from anon, authenticated;
