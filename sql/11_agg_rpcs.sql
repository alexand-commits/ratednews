-- Aggregate RPCs — replace client-side "download the whole table and count in
-- JS" patterns that both cost egress and silently truncate at PostgREST's
-- 1,000-row cap (so the numbers went wrong as the site grew).
--
-- Run once in the Supabase SQL editor.

-- 1. Category overview: per-category article count + latest article, filtered
--    by region bucket (all / UK / US / rest). Powers src/pages/CategoryPage.
create or replace function category_overview(p_region text default 'all')
returns table (
  category            text,
  cnt                 bigint,
  latest_id           uuid,
  latest_title        text,
  latest_published_at timestamptz
)
language sql
stable
as $$
  with scoped as (
    select a.category, a.id, a.title, a.published_at,
           row_number() over (partition by a.category order by a.published_at desc) as rn,
           count(*)    over (partition by a.category) as cnt
    from articles a
    left join outlets o on o.id = a.outlet_id
    where a.category is not null
      and (
        p_region = 'all'
        or (p_region = 'UK' and o.country = 'UK')
        or (p_region = 'US' and o.country = 'US')
        or (p_region not in ('all','UK','US') and coalesce(o.country,'') not in ('UK','US'))
      )
  )
  select category, cnt, id, title, published_at
  from scoped
  where rn = 1
$$;

-- 2. Contributor leaderboard: top contributors by (article ratings + outlet
--    ratings + comments), with username joined. Powers the Outlets → Leaderboard.
create or replace function contributor_leaderboard(p_limit int default 25)
returns table (
  user_id  uuid,
  username text,
  articles bigint,
  outlets  bigint,
  comments bigint,
  total    bigint
)
language sql
stable
as $$
  with u as (
    select user_id, count(*)::bigint as articles, 0::bigint as outlets, 0::bigint as comments
      from ratings where user_id is not null group by user_id
    union all
    select user_id, 0, count(*)::bigint, 0 from outlet_ratings where user_id is not null group by user_id
    union all
    select user_id, 0, 0, count(*)::bigint from comments where user_id is not null group by user_id
  ),
  agg as (
    select user_id,
           sum(articles) as articles,
           sum(outlets)  as outlets,
           sum(comments) as comments,
           sum(articles + outlets + comments) as total
    from u group by user_id
  )
  select a.user_id, p.username, a.articles, a.outlets, a.comments, a.total
  from agg a
  left join profiles p on p.user_id = a.user_id
  order by a.total desc
  limit p_limit
$$;

grant execute on function category_overview(text)     to anon, authenticated;
grant execute on function contributor_leaderboard(int) to anon, authenticated;
