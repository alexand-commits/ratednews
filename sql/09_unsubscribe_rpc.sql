-- Harden one-click unsubscribe.
--
-- Problem: the old "unsubscribe by token" UPDATE policies were
-- `using (true) with check (<flag> = false)` — the token was only enforced by
-- the API's .eq('unsub_token', …) filter, NOT by RLS. Since the anon key ships
-- to every browser, anyone could run an UNFILTERED update and flip the entire
-- audience's flag off in one request.
--
-- Fix: revoke the broad anon UPDATE and move the token-scoped flip into a
-- SECURITY DEFINER function that filters by token server-side.
--
-- Run once in the Supabase SQL editor.

-- 1. Drop the permissive policies and the anon UPDATE grant.
drop policy if exists "unsubscribe by token" on email_prefs;
drop policy if exists "unsubscribe by token" on digest_subscribers;
revoke update on email_prefs        from anon;
revoke update on digest_subscribers from anon;

-- 2. Token-scoped opt-out. Runs as the definer (table owner), so it bypasses
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

-- 3. Let the anon role call ONLY this function (not raw UPDATE).
grant execute on function unsubscribe_by_token(uuid) to anon;
