# The Coverage Report — where this is going

Written 2026-09-11. The decision behind all of it: **this is the most defensible
thing the site produces.** The page isn't the moat — the pipeline under it is.
"Same story, different words" is only computable because articles are already
clustered into stories, so copying it needs the ingest, the clustering, and a
corpus. Everything below assumes that's worth investing in properly.

Live right now: 87,687 headlines, 297 feeds, week of 31 Aug – 7 Sept.

## Done (2026-09-11)

- **Stopped destroying past weeks.** `storeCoverageReport` overwrote a single
  row every Monday, so 52 unique datasets a year collapsed to one. It now keys
  on `report.week` (date-only, `YYYY-MM-DD`) and inserts a new row per week.
  Re-running inside the same week updates that week's row, so the cron stays
  idempotent.
- **`report.week` added to the pack** — the storage key today, the URL slug
  later.
- **Fixed the page read.** `pages/coverage-report.jsx` used
  `.limit(1).maybeSingle()` with no `.order()`. Harmless with one row; with many
  it would have shown an arbitrary week's numbers under a page claiming to be
  this week's. Now ordered `created_at` desc. `maybeSingle()` is also gone — it
  throws on multiple rows, which this table now has by design.

## What this costs (measured 2026-09-12)

Short version: **the feature as it stands is one of the cheapest things the site
runs.** Alexander was right to ask, and the answer is reassuring — but two of
the proposed extensions are not cheap, so keep this section current.

| | Measured | Context |
|---|---|---|
| DB reads per sweep | **157,560 rows** (87,687 current week + 69,873 prior) | Clustering reads **2.84M rows/day** — one sweep is ~0.8% of a clustering day |
| Frequency | weekly cron `40 5 * * 1` | plus the owner-only desk button |
| Page over the wire | **105KB** Brotli (478KB uncompressed) | edge-cached, ISR 6h |
| Pack storage | 385KB × 52 = **20MB/year** | negligible |

**Don't quote the 478KB figure as the page weight** — JSON compresses ~4.5:1 and
the real transfer is 105KB. That mistake was made once in conversation already.

### The three things that WOULD cost

1. **Backfilling 52 weeks: 8.2M rows in one burst** — roughly three days of
   clustering load compressed into one job, against a database that has been
   taken down by an aggressive burst before. This is why the roadmap's backfill
   step is **optional and must be throttled across days**, not a launch
   requirement. Prefer letting the archive accumulate forward from the cron,
   which costs nothing extra.
2. **The desk's refresh button.** Owner-only but was uncapped: every click was a
   full 157k-row sweep, so twenty idle clicks would out-read a full day of
   clustering. Now guarded — skips with a 200 if the stored report is under an
   hour old, with a `force: true` escape hatch for watchlist changes.
3. **`getStaticPaths` on the archive must use `fallback: 'blocking'`.** With
   `fallback: false` every deploy pre-renders all 52 weeks.

## Next, in order

### 1. `/coverage-report/[week]` — the archive

`getStaticPaths` over the stored weeks; `/coverage-report` stays canonical for
the latest and gains an index of past weeks.

Why this first: a journalist citing "the week of 7 September" currently has to
link `/coverage-report`, which by the time anyone clicks shows different numbers
and makes their citation look wrong. That actively discourages the linking we
want. It's also 52 permanent, genuinely unique, data-rich pages a year against
14,000 near-duplicate article pages a day — the right *kind* of page to add to a
crawl-starved site.

Gotcha: the one legacy row predates `report.week` and has no key. Fall back to
`generatedAt.slice(0,10)` when building paths, or backfill the field once.

### 2. Backfill — OPTIONAL, and throttled

The pack is computed from `articles`, not from anything ephemeral, so past weeks
are recomputable as far back as retention allows. `computeCoverageReport`
hardcodes "now" and would need a window parameter.

**But see the cost section: 52 weeks is 8.2M row-reads.** Do not run this as a
loop. Either skip it entirely and let the archive build forward from the weekly
cron (free), or spread it over days with a deliberate delay between weeks. The
archive works fine without it — it just starts short.

### 3. A real share card per week

`og:image` is the generic brand card today. A per-week card carrying the
headline stat is what actually gets clicked on Bluesky and X. There's already an
`/api/og` route to extend.

### 4. Trends across weeks

Only possible once the archive exists: chart a term's usage over months, by
outlet. "How 'migrant' vs 'asylum seeker' moved over six months" is something
nobody else can publish. Right now we can only ever compare to last week,
because last week was all that survived.

## Constraints to respect

- **Counts, never conclusions.** The house rule and the reason this is credible
  where AllSides and Ad Fontes get attacked. Every published number stays
  click-to-auditable down to the headlines behind it.
- The page ships ~388KB of props (build warns). The archive multiplies page
  count, not payload — but don't let per-page payload grow further.
- `social_drafts` growth is ~52 packs a year at a few hundred KB. Fine
  unbounded for years. If it ever needs a cap, prune oldest-first, never newest.

## The honest caveat

None of this *earns* links by itself. It makes the report linkable and citable;
getting it in front of media-watchers and press-critique newsletters is
distribution work, and that's the actual bottleneck. Inbound links are the real
ceiling on Google (see the SEO notes) — this is the on-site half of that
problem, not the whole of it.
