-- Secure outlet_ratings against anonymous vote-stuffing.
--
-- Problem: with RLS off (or a permissive policy), anyone holding the public
-- anon key — which ships in every browser — can INSERT outlet_ratings rows
-- with an arbitrary user_id, manipulating outlet community_score rankings.
--
-- Fix: enable RLS and require that a row's user_id equals the authenticated
-- user's id. Anonymous (unauthenticated) requests can no longer write.
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).

-- 1. Turn on row-level security for the table.
alter table public.outlet_ratings enable row level security;

-- 2. Anyone may read ratings (needed to display scores).
drop policy if exists "outlet_ratings_select" on public.outlet_ratings;
create policy "outlet_ratings_select"
  on public.outlet_ratings
  for select
  using (true);

-- 3. A logged-in user may insert a rating only as themselves.
drop policy if exists "outlet_ratings_insert_own" on public.outlet_ratings;
create policy "outlet_ratings_insert_own"
  on public.outlet_ratings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 4. A user may update / delete only their own rating.
drop policy if exists "outlet_ratings_update_own" on public.outlet_ratings;
create policy "outlet_ratings_update_own"
  on public.outlet_ratings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "outlet_ratings_delete_own" on public.outlet_ratings;
create policy "outlet_ratings_delete_own"
  on public.outlet_ratings
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- 5. Enforce one rating per user per outlet at the DB level (defence in depth —
--    the app already checks, but a determined client can bypass app checks).
--    Run only if you don't already have this constraint.
create unique index if not exists outlet_ratings_user_outlet_uniq
  on public.outlet_ratings (user_id, outlet_id)
  where user_id is not null;
