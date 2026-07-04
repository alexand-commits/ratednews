-- Secure the article `ratings` table — same hardening as outlet_ratings (01).
--
-- Problem: `ratings` was only protected by a foreign key on user_id, which
-- blocks *fake* user ids but not *real* ones. Because `profiles` exposes every
-- real user_id, a logged-in attacker could insert article ratings on behalf of
-- any real user, stuffing article community_score. RLS closes this.
--
-- Run this in the Supabase SQL editor. Run after 01 and 02.

-- 1. Force row-level security on.
alter table public.ratings enable row level security;
alter table public.ratings force  row level security;

-- 2. Drop every existing policy, whatever it's named (permissive policies OR
--    together, so a leftover "allow all" would override the strict set).
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'ratings'
  loop
    execute format('drop policy if exists %I on public.ratings', pol.policyname);
  end loop;
end $$;

-- 3. Anyone may read ratings (needed to display scores).
create policy "ratings_select"
  on public.ratings
  for select
  using (true);

-- 4. A logged-in user may insert a rating only as themselves.
create policy "ratings_insert_own"
  on public.ratings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 5. A user may update / delete only their own rating.
create policy "ratings_update_own"
  on public.ratings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ratings_delete_own"
  on public.ratings
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- 6. One rating per user per article (defence in depth).
create unique index if not exists ratings_user_article_uniq
  on public.ratings (user_id, article_id)
  where user_id is not null;

-- 7. Verify — should show exactly the four policies created above.
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'ratings'
order by policyname;
