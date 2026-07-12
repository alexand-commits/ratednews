-- Harden one-click unsubscribe, and create digest_subscribers if it's missing.
--
-- Problem 1: the old "unsubscribe by token" UPDATE policies were
-- `using (true) with check (<flag> = false)` — the token was only enforced by
-- the API filter, NOT by RLS. Since the anon key ships to every browser, anyone
-- could run an UNFILTERED update and flip the whole audience's flag off.
--
-- Problem 2: digest_subscribers (sql/06) was never actually created in the DB,
-- so the sidebar email capture has been silently failing. Create it here with
-- the hardened policy set (no broad anon UPDATE from the start).
--
-- Fix: revoke anon UPDATE and move the token-scoped flip into a SECURITY
-- DEFINER function. Idempotent — safe to run on the existing email_prefs table.
--
-- Run once in the Supabase SQL editor (paste the whole file).

-- 1. email_prefs already exists — drop the insecure policy + anon UPDATE grant.
drop policy if exists "unsubscribe by token" on email_prefs;
revoke update on email_prefs from anon;

-- 2. digest_subscribers — create if absent (public signup insert only; opt-out
--    goes through the function below, never a broad anon UPDATE).
create table if not exists digest_subscribers (
  email       text primary key check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  unsub_token uuid not null default gen_random_uuid(),
  subscribed  boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table digest_subscribers enable row level security;

-- Anyone may sign up (insert only — no select policy, so the list can't be scraped).
drop policy if exists "public signup" on digest_subscribers;
create policy "public signup" on digest_subscribers
  for insert with check (true);

-- Remove any legacy insecure opt-out policy if a prior run created it.
drop policy if exists "unsubscribe by token" on digest_subscribers;
revoke update on digest_subscribers from anon;

-- 3. Token-scoped opt-out. Runs as the definer (table owner), so it bypasses
--    RLS — but it can ONLY ever flip the one row whose token matches, off.
create or replace function unsubscribe_by_token(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update email_prefs
     set weekly_digest = false, updated_at = now()
   where unsub_token = p_token;
  update digest_subscribers
     set subscribed = false
   where unsub_token = p_token;
end;
$$;

-- 4. Let the anon role call ONLY this function (not raw UPDATE).
grant execute on function unsubscribe_by_token(uuid) to anon;
