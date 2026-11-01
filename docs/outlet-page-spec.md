# Outlet pages — spec

Written 2026-11-01, after Google Search Console returned **"Crawled – currently
not indexed"** for `/outlet/bbc-news`.

## The problem, measured

```
/outlet/bbc-news   211 rendered words / 257 server-rendered
                   one of 257 near-identical templated pages
                   last crawled 31 Jul 2026, never returned
```

Googlebot fetched the page successfully — crawl allowed, indexing allowed,
canonical correct, in the sitemap, internally linked. Nothing is broken. Google
read 211 words of mostly boilerplate, recognised it as one of a few hundred
pages differing only by a name and two numbers, and declined to index it.

This is not the same bucket as the 1,010 pages sitting at **"Discovered –
currently not indexed"**, which Google has never fetched at all. Both have the
same root cause — a low quality prior on an unlinked domain — but only this one
is addressable by changing the page.

Bing indexes these pages happily. Google's bar is higher and we are under it.

## The opportunity

An outlet page is currently a logo, a score, a section list and a feed of
borrowed headlines. Everything on it is available from the outlet itself, better.

But we hold a weekly corpus of ~76,000 articles across 292 outlets, clustered by
story. That lets an outlet page answer questions **no one else can answer about
that outlet**, including the outlet itself — because answering them requires
watching all 292 at once.

Measured for BBC News, week to 2026-11-01:

| Stat | Value | Why it is ours alone |
|---|---|---|
| Carried by nobody else | **52 of 165 (32%)** | needs every other outlet's output to know |
| First to report | **10 times**, of 87 contested stories | needs cross-outlet timestamps |
| Beat skew | **Crime 1.9×**, Politics 1.2×, Sport 0.3× | needs a corpus average to compare against |
| Volume rank | **#129 of 292** | needs the whole field |

Rendered as prose on the page:

> This week BBC News published **165 stories** in our index. **32% were carried
> by no other outlet we track.** It was **first to report 10 times** out of 87
> stories that several outlets covered. It files **1.9× more Crime** than the
> average outlet in our index, and **a third as much Sport**.

That is roughly 60 words of genuinely original, specific, non-templated content
per outlet, regenerated weekly — the exact thing missing today.

## Architecture: precompute weekly, read free

**Do not compute this at page render.** The numbers above required scanning
75,904 rows. At render time that is a 75k-row read per outlet page view, on a
database that has already been brought down once this year by a missing index.

`scripts/coverage-report.mjs` already runs weekly, already loads the full
corpus, and already computes `firstToReport` per outlet. Extend that run to emit
a per-outlet block and store it alongside the weekly pack. Outlet pages then
read one small row.

This is the same trade that made `cluster_peers` work, and the same rule
`docs/story-intelligence-spec.md` sets out: **compute once at write time, read
free at render.** It is also the rule the StoryIntelligence panel currently
violates, which is a known debt.

Storage: ~300 outlets × a few hundred bytes × 52 weeks ≈ a few MB a year.

## Honest limits — these must be stated on the page

1. **"Published 165 stories" is wrong.** It is 165 stories *in our index*, from
   that outlet's RSS feed, which is a subset of what it publishes. The copy must
   say "in our index" every time. Claiming to count an outlet's total output
   would be false and checkable.

2. **"Carried by nobody else" depends on clustering**, which is measurably
   imperfect — one story fragmented across ten clusters in September, and a
   Houthi/Mecca article once joined a NATO/Lithuania cluster on generic war
   vocabulary. An over-fragmented cluster inflates this figure.

3. **"First to report" depends on `published_at`**, and
   `docs/story-intelligence-spec.md` measured that ~33% of rows fall in the
   first four minutes of a quarter-hour, against ~27% expected — ingest stamps
   feeds lacking a `pubDate` with ingest time. Irish Independent 50%, CTV News
   46%, Newsweek 5%. The ≥5 minute clear-lead guard already in `attention()`
   must be kept, and Phase 0 (`published_at_source`) should land before this
   claim is made prominent.

4. **Beat skew depends on `category`**, which is assigned by our own
   classifier. It measures what we labelled, not what the outlet thinks it
   covers.

Every one of these is survivable if the page says "in our index" and reports
counts rather than conclusions — the house rule everywhere else on the site.

## What NOT to build

- **No quality or trust judgements derived from these stats.** "First to report
  10 times" is a count. "BBC News is fast and reliable" is a conclusion we have
  not earned and cannot defend. The community rating is the only judgement on
  the page.
- **No comparison tables against named rivals** on the outlet page. That is what
  `/compare/a-vs-b` exists for, and inviting the comparison implicitly is
  cheaper than asserting it.
- **Nothing that fires on thin data.** An outlet with 4 articles this week should
  render none of this rather than "100% exclusive", which is noise wearing a
  statistic's clothes. Suggested gate: 20+ articles in the week.

## Expected effect, stated honestly

This is worth building because the pages are genuinely better afterwards, and
because it is work that also improves Bing CTR and gives readers a reason to
look at an outlet page at all.

It is **not** a reliable fix for the indexing problem. Google's bar is set by
domain authority as much as page quality, and an unlinked domain can produce
good pages and still not be indexed. The honest ordering of levers is:

1. **Inbound links** — the actual ceiling, and entirely off-site.
2. **Page quality** — this spec.
3. **Fewer competing URLs** — 933k pages dilute a small allocation.

Build this for the second reason, not because it will move GSC next month. If it
does, that is a bonus rather than the thesis.

## Order of work

1. Extend `coverage-report.mjs` to emit per-outlet stats into the weekly pack.
2. Render them on `/outlet/[slug]` behind the 20-article gate, with "in our
   index" phrasing.
3. Leave "first to report" out of the prose until Phase 0 lands; keep it in the
   stored data so it is ready.
