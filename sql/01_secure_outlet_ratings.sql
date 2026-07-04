-- Secure outlet_ratings against anonymous vote-stuffing.
--
-- Problem: with RLS off (or a permissive policy), anyone holding the public
-- anon key — which ships in every browser — can INSERT outlet_ratings rows
-- with an arbitrary user_id, manipulating outlet community_score rankings.
--
-- Fix: enable RLS and require that a row's user_id equals the authenticated
-- user's id. Anonymous (unauthenticated) requests can no longer write.
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
--
-- NOTE: Postgres ORs permissive policies together — a single leftover
-- "allow all" policy (e.g. a Supabase dashboard quickstart default) will
-- override a restrictive one. So we drop EVERY existing policy on the table
-- first, then recreate only the strict set. This is why step 2 loops rather
-- than dropping policies by name.

-- 1. Turn on (and force) row-level security for the table.
--    force ensures the table owner is also subject to RLS.
alter table public.outlet_ratings enable row level security;
alter table public.outlet_ratings force  row level security;

-- 2. Drop every existing policy on the table, whatever it's named.
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'outlet_ratings'
  loop
    execute format('drop policy if exists %I on public.outlet_ratings', pol.policyname);
  end loop;
end $$;

-- 3. Anyone may read ratings (needed to display scores).
create policy "outlet_ratings_select"
  on public.outlet_ratings
  for select
  using (true);

-- 4. A logged-in user may insert a rating only as themselves.
create policy "outlet_ratings_insert_own"
  on public.outlet_ratings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 5. A user may update / delete only their own rating.
create policy "outlet_ratings_update_own"
  on public.outlet_ratings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "outlet_ratings_delete_own"
  on public.outlet_ratings
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- 6. Enforce one rating per user per outlet at the DB level (defence in depth —
--    the app already checks, but a determined client can bypass app checks).
create unique index if not exists outlet_ratings_user_outlet_uniq
  on public.outlet_ratings (user_id, outlet_id)
  where user_id is not null;

-- 7. Verify — should show exactly the four policies created above.
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'outlet_ratings'
order by policyname;
