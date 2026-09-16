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

## TESTED 2026-09-15 — what survived contact with the data

Every idea below was measured against real clusters before building. Two of the
four I was most confident about are dead. Recording the negatives so nobody
re-attempts them.

| Idea | Fires on | Verdict |
|---|---|---|
| Framing split (watchlist) | **0 of 606** stories | **DEAD** |
| Generic word divergence | 92% — but wrong signal | **DEAD** |
| Coverage velocity | 6 of 701 (0.9%) in its interesting form | **DEMOTED** |
| Headline overlap | 61% any, 18% heavy | **BUILD** |
| Still developing | 20% | **BUILD** |
| Geographic spread | ~every multi-outlet story | keep, modest |
| Numeric disagreement | **2 of 1,467** stories | **DEAD** (2026-09-16) |

### Why framing died
`FRAMING_SETS` requires 2+ competing labels each used by 2+ distinct publishers
inside one cluster. Across 606 recent clusters it fired **zero times**; the
weekly report finds ~3 in 11,675. That is one article in four thousand — nobody
would ever see it. Headlines are short and rarely carry a watchlist term at all.

### Why the generic version also died
Deriving distinctive words from the cluster itself (no watchlist) fires on 92%
of stories, but produces DETAIL differences, not framing differences:

```
3/5 "moaning"  3/5 "myrtle"    <- character names
8/16 "face"    8/16 "parents"  <- generic verbs
3/4 "king"     3/4 "charles"   <- the story's own subject
```

Framing words are **substitutable** (protest <-> riot: same thing, different
word). These are **additive** (extra facts). Telling them apart needs to know
which words are alternatives for each other — i.e. a watchlist (starves, proven
above) or a language model (off the table, and correctly so for this product).

**"Same story, different words" is not achievable at headline level here.** It
remains a fine idea for the weekly report over a whole corpus, where rarity is
survivable because you only need a handful of examples.

### Why numeric disagreement died (2026-09-16)

The pitch: outlets disagree on casualty counts, and a reader understands a
number instantly. No semantics needed — a regex for digits and number-words
adjacent to a context term (`killed` / `injured` / `arrested` / `missing`).

Measured over 1,467 clusters of 3+ members:

| | headlines | + summaries |
|---|---|---|
| any extractable measure | 3.3% | 4.0% |
| 2+ distinct values | 0.4% | 0.7% |
| each value backed by 2+ publishers | **0.1%** | **0.1%** |

Two stories in 1,467. Adding summaries moved nothing, which kills the obvious
objection that headlines are simply too short.

**And half of what fires is wrong.** One of the two hits was real — a Gaza
building collapse reported as 10, 11, 12, 14 and 16 dead, exactly the intended
output. The other was a mis-clustered pair of unrelated ferry sinkings,
Indonesia (129 missing) and Vanuatu (30 missing), rendered as though outlets
disagreed about one event. That is worse than a miss: it would publish a
fabricated contradiction, on the page whose whole claim is trustworthy numbers.

So the feature inherits every clustering error as a factual assertion. It would
need a much stronger same-event guarantee than the clustering currently gives —
and it would still only fire twice a week.

**The pattern across all four dead ideas is now clear.** Framing 0/606, velocity
6/701, numeric disagreement 2/1,467. The corpus is mostly small clusters, and a
headline plus a two-line summary does not carry enough specific claim to compare
across outlets. What survives (overlap, spread, still-developing) works because
it measures the SHAPE of coverage rather than its CONTENT. Future ideas should
be tested against that distinction first.

### Why velocity was demoted
Median story: 0.4 outlets/hour over 18.7 hours. The compelling form — 8+ outlets
inside 3 hours — is **6 of 701 stories**. "Covered over 19 hours" is true and
boring. Same failure shape as framing, milder.

### What worked: headline overlap
Jaccard over tokenised headlines, 0.6 threshold. 61% of stories have at least one
near-identical pair, 18% have 30%+ of pairs matching. Both ends inform:

- Supreme Court mail-ballot ruling: **60 outlets, 40 near-identical**
- Lane Kiffin / Ole Miss: **13 outlets, 0 matching** — all independently written

**Never call it "syndication".** Outlets can land on the same words independently
for a simple factual story. State the count, let the reader conclude — the house
rule, and also the only defensible version.

### Honest scope limit on all of it
Median story is 3 outlets; half have exactly two. Everything here is a feature
for the long tail of BIG stories. That happens to be where search traffic lands,
so it is not as narrow as it sounds — but the typical article page shows none of
it, and that should stay true rather than being padded out.


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

**SUPERSEDED — see TESTED above. This fires on 0 of 606 stories and should not
be built for article pages.** Headline overlap is the feature that does what this
was meant to do.

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
