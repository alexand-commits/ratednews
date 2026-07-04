-- Move community_score computation server-side so clients can't tamper with it.
--
-- Problem: both rating modals recompute community_score in the browser and write
-- it straight to outlets / articles. That means the displayed score is only ever
-- "whatever the last browser pushed" — a logged-in user can UPDATE any outlet's
-- or article's community_score directly, independent of real ratings.
--
-- Fix: database triggers recompute community_score + total_ratings from the
-- source rating rows on every INSERT/UPDATE/DELETE. Then we revoke direct client
-- write access to those columns (see step 4) so the number can only ever reflect
-- actual ratings. Run in the Supabase SQL editor.
--
-- Prerequisite: run 01_secure_outlet_ratings.sql first.

-- ── Outlets ──────────────────────────────────────────────────────────────────
create or replace function public.recompute_outlet_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.outlet_id, old.outlet_id);
begin
  update public.outlets o
  set community_score = coalesce((
        select round(avg(r.overall_stars) * 20)
        from public.outlet_ratings r
        where r.outlet_id = target
      ), 0),
      total_ratings = (
        select count(*)
        from public.outlet_ratings r
        where r.outlet_id = target
      )
  where o.id = target;
  return null;
end;
$$;

drop trigger if exists trg_recompute_outlet_score on public.outlet_ratings;
create trigger trg_recompute_outlet_score
  after insert or update or delete on public.outlet_ratings
  for each row execute function public.recompute_outlet_score();

-- ── Articles ─────────────────────────────────────────────────────────────────
create or replace function public.recompute_article_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.article_id, old.article_id);
begin
  update public.articles a
  set community_score = coalesce((
        select round(avg(r.overall_stars) * 20)
        from public.ratings r
        where r.article_id = target
      ), 0),
      total_ratings = (
        select count(*)
        from public.ratings r
        where r.article_id = target
      )
  where a.id = target;
  return null;
end;
$$;

drop trigger if exists trg_recompute_article_score on public.ratings;
create trigger trg_recompute_article_score
  after insert or update or delete on public.ratings
  for each row execute function public.recompute_article_score();

-- ── Lock down direct client writes to the score columns ──────────────────────
-- With the triggers in place, no client ever needs to UPDATE outlets/articles.
-- Enable RLS with no UPDATE policy for the anon/authenticated roles: reads still
-- work (policies below), but score columns can only change via the triggers,
-- which run as security definer.
alter table public.outlets  enable row level security;
alter table public.articles enable row level security;

drop policy if exists "outlets_select"  on public.outlets;
create policy "outlets_select"  on public.outlets  for select using (true);

drop policy if exists "articles_select" on public.articles;
create policy "articles_select" on public.articles for select using (true);

-- Note: the ingest + aggregate scripts use the service_role key, which bypasses
-- RLS, so they can still insert/update outlets and articles normally.

-- ── Backfill existing scores once ────────────────────────────────────────────
update public.outlets o
set community_score = coalesce((select round(avg(r.overall_stars) * 20) from public.outlet_ratings r where r.outlet_id = o.id), 0),
    total_ratings   = (select count(*) from public.outlet_ratings r where r.outlet_id = o.id);

update public.articles a
set community_score = coalesce((select round(avg(r.overall_stars) * 20) from public.ratings r where r.article_id = a.id), 0),
    total_ratings   = (select count(*) from public.ratings r where r.article_id = a.id);
