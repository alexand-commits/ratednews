# Story intelligence — spec

What an article page can tell a reader that the source cannot. Written 2026-09-15
against measured data, after GA showed 12s average engagement, 0.40 engaged
sessions per user and 6 returning users of 186.

**The diagnosis this answers:** an article page currently holds about 30 words of
our own content — a borrowed headline, a borrowed two-line summary, and a list of
links. Twelve seconds is roughly the honest reading time of that. The page isn't
being skimmed, it's being consumed correctly and it's nearly empty.

**The architectural rule for all of it:** compute at CLUSTERING time, store on the
row, read free at render. Never at page render. This is the same trade that made
`cluster_peers` work. Clustering already holds every member's title, outlet and
timestamp in memory, so each feature below is arithmetic over data already
loaded, not new queries.

---

## Phase 0 — timestamp provenance (blocks Phase 2)

`scripts/ingest.mjs:1034` sets `published_at` to the feed's `pubDate` when it is
present, valid and not in the future — and otherwise silently falls back to
`new Date()`, i.e. ingest time. Ingest runs every 15 minutes, so those rows are
stamped up to 15 minutes late and the outlet looks slower than it is.

Measured over 1,000 recent articles by looking for rows clustered just after each
quarter-hour boundary:

| | |
|---|---|
| Overall in the first 4 min of a quarter | 33% (≈27% expected if random) |
| Minute-0 bucket | 1.8x overrepresented |
| Irish Independent | 50% |
| CTV News | 46% |
| Newsweek | 5% (clean) |

So the corpus is mostly honest, with a concentrated minority that is not. That is
survivable for aggregate weekly stats and NOT survivable for a per-story claim
like "Reuters was 6 minutes ahead of the Guardian".

**Build:** add `published_at_source text` to `articles` — `'feed'` or `'ingest'` —
set at insert. One column, no extra queries, no backfill possible (the
information is gone for existing rows, so Phase 2 waits for new data).

**Cost:** ~8 bytes/row. Nothing.

---

## Phase 1 — framing split + spread (build first)

### 1a. Framing split per story

> "Of the 34 outlets covering this: 12 said *protest*, 9 said *riot*."

`framingSplits()` already exists in `src/server/coverage-compute.js` and does
exactly this weekly across the whole corpus. Running it per cluster is the same
function against a smaller input, using `FRAMING_SETS` from
`coverage-watchlist.js` (9 sets since 2026-09-13).

Store on the cluster as `framing: [{subject, usage:[{label, outlets, sample}]}]`.

**This is the one thing a reader genuinely cannot get at the source**, and it is
the page's reason to exist.

**Cost: near zero.** Regex over ~30 titles already in memory, inside a write that
already happens.

**Honest limit:** the weekly report found splits on 3 of 11,675 stories. Most
stories will have NO split, and the section must render nothing rather than
something apologetic. Treat it as a highlight, not a fixture.

### 1b. Geographic spread

> "19 UK outlets, 8 US, 7 international."

`outlets.country` is already joined in the clustering fetch.

**Cost: zero.** Counting a field already in memory. Works on every story, which
makes it the reliable counterpart to 1a's rarity.

---

## Phase 2 — time to story (after Phase 0 has data)

> "First reported by Reuters. The Guardian followed 6 minutes later. The Times,
> 3 hours."

**Only include members with `published_at_source = 'feed'`**, and say so in the
methodology. An outlet excluded for want of a trustworthy timestamp is better
than an outlet libelled as slow.

Keep the existing ≥5 minute clear-lead guard from `attention()` — wire
syndication republishes with the agency's original timestamp, so closer calls
say nothing.

**Cost: zero compute.** Arithmetic on loaded data. The cost is the wait for
Phase 0 to accumulate.

---

## Phase 3 — trust x framing (the missing piece)

Displaying "the outlets covering this average 4.2" is inert. It states a fact and
asks nothing of the reader, and averaging a trust score across a story says
nothing interesting.

**What makes it alive is crossing it with 1a:**

> "The 12 outlets that called it a *protest* average **4.3** community trust.
> The 9 that called it a *riot* average **3.6**."

That is the fusion of the two products — aggregation and community ratings — and
nobody else can publish it, because nobody else has both halves.

**It cannot be built today, and that is the actual finding.** Measured
2026-09-13: 305 outlets, 91 with any rating, **13 rank-eligible** (3+ ratings),
maximum 5 ratings on any single outlet. Any given story's outlets are almost all
unrated, so the comparison would be computed from nothing.

**So Phase 3 is really two things, and the first one is the product loop:**

1. **Recruit the data.** The article page should show the reader which of the
   outlets in front of them they have and haven't rated — "you've rated 2 of
   these 34" — and make rating them one tap. Every story becomes a prompt to
   rate the specific outlets that reader is already looking at, which is a far
   better ask than a cold "rate this outlet" on a page they arrived at from
   search.
2. **Then the comparison**, once enough outlets clear the 3-rating threshold.

Gate the display on sample size: show the trust-by-framing split only when both
sides have 3+ rated outlets. Below that, show nothing rather than a number built
on two ratings — the house rule is counts, never conclusions, and a mean of two
is a conclusion.

**Cost:** one join at clustering time against a 305-row table. Zero, once the
ratings exist.

---

## Storage

All of the above adds JSONB to clustered article rows. There are ~849,000
articles and ~12,000 clustered at any time, but `cluster_peers` shows the shape
of the problem: the same payload is written to every member of a cluster.

3,078 clusters covering 12,002 articles = **~4x duplication**.

A `clusters` table was parked in earlier work. Writing story intelligence per
CLUSTER rather than per ARTICLE cuts this by that factor and is the right shape.
Estimate for the per-article route: **150-250 MB** on a 1.6 GB database with 8 GB
provisioned — affordable, but the per-cluster route is affordable AND correct.

**Recommended order:** Phase 0, then 1b (works everywhere, zero cost), then 1a
(highest value, rare), then the Phase 3 rating prompt, then Phase 2, then the
trust comparison once the ratings support it.
