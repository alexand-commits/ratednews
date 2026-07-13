-- Purge the retired AI pipeline's columns.
--
-- These were written by the AI scoring pipeline (scripts/score.mjs +
-- scripts/aggregate-outlets.mjs, both deleted from the repo) and have been
-- frozen since AI scoring was removed in June 2026. Nothing reads them as of
-- the July 13 deploy — dropping them makes it impossible to mistake them for
-- live community data again (which already happened once: an outlet FAQ
-- briefly attributed the AI-era fair_rate to "readers").
--
-- KEPT deliberately:
--   ratings.headline_vote — real reader votes from the rating modal (fair/
--   misleading/clickbait). Not aggregated anywhere yet, but it's genuine
--   community data and the raw material for future honest outlet-level rates.
--
-- Run once in the Supabase SQL editor, AFTER the July 13 code deploy is live.

alter table outlets
  drop column if exists overall_score,
  drop column if exists accuracy_score,
  drop column if exists bias_score,
  drop column if exists bias_direction,
  drop column if exists fair_rate,
  drop column if exists misleading_rate,
  drop column if exists clickbait_rate,
  drop column if exists article_count_30d,
  drop column if exists accuracy_delta_7d;

alter table articles
  drop column if exists accuracy_score,
  drop column if exists bias_score,
  drop column if exists bias_direction,
  drop column if exists headline_vote,
  drop column if exists ai_summary,
  drop column if exists article_type;
