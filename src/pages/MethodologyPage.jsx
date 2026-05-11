import React, { useState } from 'react'

const SYSTEM_PROMPT = `You are a neutral media analyst. For each news article you receive, return a JSON object with these exact fields:

- "accuracy_score": integer 0–100. How factually reliable does this article appear based on its title and summary?
  100 = highly factual, well-sourced journalism. 0 = clearly false or fabricated.
  Use 70–85 as baseline for mainstream outlets with no obvious issues.
  IMPORTANT — sport match reports: goals, scores, results, and player actions are verifiable facts.
  Do NOT penalise accuracy for dramatic or colourful match-report language ("fires", "nets", "slots home",
  "brilliant", "stunner") — these are standard sports-writing conventions, not inaccuracies.
  A factually correct match report with vivid language should score 75–90.
  Only lower accuracy_score if the reported facts themselves appear wrong (wrong scoreline, wrong scorer, etc.).
  CRITICAL — do NOT use your training-data knowledge of player club affiliations to judge accuracy.
  Player transfers and loan moves happen constantly and your knowledge may be outdated. If an article says
  a player scored for a club, trust the article — do not flag it as inaccurate because you believe the player
  is at a different club. Judge only the internal consistency between title and summary.
  IMPORTANT — tribute, memorial and human interest content: emotional or reverential language in
  articles about deaths, memorials, tributes, retirements, and community stories is appropriate
  writing style, not a sign of inaccuracy. Score these 75–90 if the facts are internally consistent.
  Do NOT penalise for empathetic tone, first-person community framing, or lack of hard data sources.

- "bias_direction": string, one of: "left", "centre", "right".
  The political lean of the article's framing and perspective.
  "left" = progressive or liberal framing. "right" = conservative framing. "centre" = balanced or no clear lean.

- "bias_score": integer 0–100. Partisan intensity — how opinionated or one-sided is the writing style,
  regardless of which direction it leans?
  0 = completely objective, factual reporting with no editorial voice.
  50 = some framing or perspective detectable but not dominant.
  100 = highly partisan, strongly one-sided language, clear agenda being pushed.
  Important: a calm left-leaning article can score 10. A neutral-topic opinion piece can score 80.
  Direction and intensity are independent.

- "headline_vote": string, one of: "fair", "misleading", "clickbait".
  "fair" = headline accurately reflects the content.
  "misleading" = headline implies something not supported by the summary.
  "clickbait" = headline uses emotional bait, exaggeration, or withholds key info to drive clicks.
  IMPORTANT — sport headlines: colourful verbs ("fires", "nets", "slots home", "inspires") and
  player-focused framing ("Rashford fires Barca to title") are normal sports-writing conventions.
  Only mark "misleading" if the headline states or strongly implies a fact that the summary contradicts
  (e.g. headline says player scored a hat-trick but summary says he scored once). Sensational but
  accurate sports language should be "fair", not "misleading".
  IMPORTANT — tribute, memorial and human interest content: articles about deaths, memorials,
  tributes, retirements, community stories and human interest pieces naturally use emotional,
  reverential or narrative language. This is appropriate writing style, not inaccuracy or bias.
  Do NOT penalise accuracy_score for empathetic or emotional framing in these contexts — a
  factually correct tribute piece should score 75–90. Only lower accuracy_score if the reported
  facts themselves appear wrong. Similarly do not inflate bias_score for emotional tone alone.

- "category": string, one of: "Politics", "Business", "Sport", "Tech", "Science", "Health",
  "Environment", "Entertainment", "Crime", "Travel", "Education", "Conflict", "World".
  Use "Conflict" for stories about armed conflict, wars, military operations, airstrikes, battles,
  casualties in war zones, or geopolitical tensions involving military force — this includes Ukraine,
  Gaza, Middle East, Sudan, and any active conflict zone. Do NOT assign these to Politics or World.
  Use "Tech" for stories about technology companies, AI, software, hardware, cybersecurity, social
  media platforms, and the tech industry — even if they have a business angle.
  Use "Entertainment" for arts, music, film, TV, celebrity, fashion, food, culture, and lifestyle stories.
  Use "World" for international news or stories that don't fit another category.

- "geographic_scope": string, one of: "local", "national", "global".
  How broad is the story's relevance to a general reader?
  "local" = primarily about a specific city, town, county, or sub-national region with little wider significance.
  "national" = relevant across an entire country.
  "global" = clear international significance or spans multiple countries.
  When in doubt between national and global, prefer "national".

- "article_region": string, one of: "UK", "US", "Europe", "MiddleEast", "Africa", "AsiaPac",
  "Americas", "International".
  The geographic region this article is primarily ABOUT — not where the outlet is based.
  "Europe" = European countries excluding UK (France, Germany, Russia, Ukraine, etc).
  "MiddleEast" = Israel, Gaza, Iran, Iraq, Saudi Arabia, Turkey, UAE, Yemen, Lebanon, Syria, etc.
  "AsiaPac" = China, Japan, India, South Korea, Australia, Southeast Asia, etc.
  "Americas" = Latin America, Canada, or the Caribbean.
  "International" = spanning multiple regions with no single clear geographic focus.
  When a US outlet covers a UK story, tag "UK". Follow the story, not the outlet.

- "ai_summary": string. A 1–2 sentence neutral summary of what the article is about.
  Write as if summarising for someone who hasn't read it. Do not editorialise.

Respond with ONLY the JSON object — no markdown, no explanation, no code fences.`

const WEIGHTING_ROWS = [
  { votes: '0 ratings',   ai: 70, editorial: 30, community: 0 },
  { votes: '1–4 ratings', ai: 50, editorial: 30, community: 20 },
  { votes: '5–19 ratings',ai: 40, editorial: 25, community: 35 },
  { votes: '20+ ratings', ai: 35, editorial: 25, community: 40 },
]

const CHANGELOG = [
  {
    date: 'May 2026',
    entries: [
      'All scored articles now always display their credibility badge — an earlier outlet reputation gate that suppressed low scores for high-reputation outlets was removed in favour of full transparency.',
      'Scoring prompt updated: added sports match report carve-out. Colourful match-report language ("fires", "nets", "stunner") is now correctly treated as convention, not inaccuracy. Transfer knowledge cut-off caveat added — article claims about player club affiliations are trusted over training data.',
      'Scoring prompt updated: added tribute and memorial carve-out. Emotional or reverential language in articles about deaths, retirements, and community stories is no longer penalised for accuracy or inflated for bias.',
      'Headline verdict badges renamed for clarity — "⚠ Misleading headline" and "✗ Clickbait headline" now appear in-card only when a verdict other than "fair" is returned.',
      'Outlet pages redesigned: added ranking position (country and global), category coverage breakdown, and highest-scored articles widget. Score history chart removed — individual article score variance was too high to produce meaningful trend lines.',
      'Added article_region field — articles are now tagged with the geographic region they are about, not just the outlet\'s home country. Powers region filtering in the feed.',
      'Launched "Score movers" on Rankings page — tracks 7-day accuracy changes per outlet and saves daily snapshots.',
    ]
  },
  {
    date: 'April 2026',
    entries: [
      'Initial launch. AI scoring pipeline live with accuracy, bias, headline, category, and geographic scope fields.',
      'Outlet scores calculated as rolling 30-day averages, blended with community ratings using tiered weighting.',
      'Regional filters added across Feed, Rankings, and Outlets pages.',
    ]
  },
]

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 20, fontWeight: 700, marginBottom: 12, paddingBottom: 10, borderBottom: '0.5px solid var(--border)' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function Callout({ color = 'var(--amber)', children }) {
  return (
    <div style={{
      borderLeft: `3px solid ${color}`,
      paddingLeft: 14,
      marginBottom: 16,
      color: 'var(--text2)',
      fontSize: 14,
      lineHeight: 1.7,
    }}>
      {children}
    </div>
  )
}

export default function MethodologyPage({ goBack }) {
  const [promptOpen, setPromptOpen] = useState(false)

  return (
    <div className="page-content">
      <div className="container" style={{ maxWidth: 720 }}>
        <button className="back-btn" onClick={goBack}>← Back</button>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--coral)', marginBottom: 10 }}>
            Methodology
          </div>
          <h1 style={{ fontFamily: 'var(--font-playfair), serif', fontSize: 28, fontWeight: 700, lineHeight: 1.25, marginBottom: 14 }}>
            How RatedNews scores the news
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.75, marginBottom: 0 }}>
            Every article on RatedNews is scored automatically by AI, then blended with community ratings over time.
            This page explains the full process — including the exact prompt we send to the AI, the weighting formula,
            and where the approach falls short. Nothing is hidden.
          </p>
        </div>

        {/* What we score */}
        <Section title="What gets scored">
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.75, marginBottom: 14 }}>
            RatedNews scores two things: <strong>individual articles</strong> and <strong>outlets</strong>.
          </p>
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.75, marginBottom: 14 }}>
            <strong>Articles</strong> are scored as they are ingested — every 30 minutes, across 100+ syndicated feeds.
            Each article receives an accuracy score, bias direction, partisan intensity, headline verdict, category,
            geographic scope, and region tag. These are generated in a single AI call per article.
          </p>
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.75 }}>
            <strong>Outlet scores</strong> are rolling 30-day averages of their articles' scores, recalculated every hour.
            They are then blended with community ratings using a tiered weighting system explained below.
          </p>
        </Section>

        {/* AI scoring */}
        <Section title="How AI scoring works">
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.75, marginBottom: 16 }}>
            Each article is sent to <strong>Claude Haiku</strong> (Anthropic's fastest model) with a fixed system prompt.
            The model receives three inputs: the article title, the outlet name, and the syndicated summary — typically 1–3 sentences.
          </p>
          <Callout color="var(--amber)">
            We score only from the headline and syndicated summary — the content publishers explicitly provide for
            distribution. We deliberately don't fetch or process full article HTML, both to respect publisher
            content rights and because the bias signals most legible to automated analysis are concentrated in
            how a story is framed upfront. This means scores are probabilistic signals, not verified facts.
            See Limitations below.
          </Callout>
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.75, marginBottom: 16 }}>
            The model returns a structured JSON response with all score fields in a single pass.
            We use prompt caching so the system instructions are only processed once per session,
            reducing cost and latency.
          </p>

          {/* The prompt */}
          <div style={{ marginBottom: 8 }}>
            <button
              onClick={() => setPromptOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, fontWeight: 600, color: 'var(--text1)',
                background: 'var(--surface)', border: '0.5px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '9px 14px',
                cursor: 'pointer', width: '100%', textAlign: 'left',
                transition: 'border-color 0.15s',
              }}
            >
              <span style={{ fontSize: 16 }}>{promptOpen ? '▾' : '▸'}</span>
              View the full scoring prompt
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>
                Sent verbatim to Claude on every article
              </span>
            </button>
            {promptOpen && (
              <pre style={{
                background: 'var(--bg)',
                border: '0.5px solid var(--border)',
                borderTop: 'none',
                borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
                padding: '16px',
                fontSize: 12,
                lineHeight: 1.7,
                color: 'var(--text2)',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}>
                {SYSTEM_PROMPT}
              </pre>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6, marginTop: 10 }}>
            This prompt is updated periodically as we refine our definitions. Changes are logged in the changelog at the bottom of this page.
          </p>
        </Section>

        {/* Outlet score weighting */}
        <Section title="How outlet scores are calculated">
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.75, marginBottom: 16 }}>
            An outlet's overall score blends three signals. The balance shifts as community ratings accumulate —
            early on the AI leads, but a well-rated outlet's community voice eventually carries the most weight.
          </p>

          {/* Weighting table */}
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                  {['Community ratings', 'AI score', 'Editorial baseline', 'Community score'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WEIGHTING_ROWS.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
                    <td style={{ padding: '9px 12px', fontWeight: 600 }}>{row.votes}</td>
                    <td style={{ padding: '9px 12px', color: 'var(--text2)' }}>{row.ai}%</td>
                    <td style={{ padding: '9px 12px', color: 'var(--text2)' }}>{row.editorial}%</td>
                    <td style={{ padding: '9px 12px', color: row.community > 0 ? 'var(--text1)' : 'var(--text3)' }}>{row.community > 0 ? `${row.community}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.75, marginBottom: 10 }}>
            The <strong>editorial baseline</strong> is fixed at 50 (neutral) until we introduce manual editorial review.
            It acts as a stabilising anchor — preventing a handful of extreme article scores from producing a wildly
            unrepresentative outlet score.
          </p>
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.75 }}>
            The <strong>community score</strong> converts star ratings (1–5 stars) to a 0–100 scale.
            Community ratings only appear on an outlet's score once at least one rating exists.
          </p>
        </Section>

        {/* Limitations */}
        <Section title="Known limitations">
          <Callout color="var(--coral)">
            We think publishing limitations is more useful than hiding them. These are the things you should keep in mind when interpreting any score on this site.
          </Callout>

          {[
            {
              title: 'Scores are based on syndicated content only',
              body: 'Accuracy and bias scores are derived from the headline and syndicated summary — the content publishers explicitly provide for distribution. We don\'t fetch or process full article HTML. A misleading article with a factual-sounding headline can score well. A nuanced long-read might score differently in full. Treat scores as signals, not verdicts.',
            },
            {
              title: 'Accuracy scores are probabilistic, not verified',
              body: '"Accuracy score: 82" does not mean 82% of the claims in the article are true. It means the writing pattern matches what well-sourced, factual journalism tends to look like. We are pattern-matching on language, not fact-checking claims. No automated system can do that reliably at this scale.',
            },
            {
              title: 'Small sample sizes produce unstable outlet scores',
              body: 'An outlet with 8 articles this week has a much less reliable score than one with 300. A single unusual article can swing a small outlet\'s score significantly. We display article counts on outlet pages so you can judge the sample size yourself.',
            },
            {
              title: 'The AI model is not neutral',
              body: 'Claude (like all large language models) has been trained on a large corpus of text that reflects particular distributions of language, perspective, and framing. We have tuned the prompt carefully, but the model\'s underlying tendencies are not fully transparent even to us. We change the model or prompt, we log it.',
            },
            {
              title: 'Bias direction from a headline is coarse',
              body: 'Detecting political lean from a 12-word headline is an inherently imprecise task. Short headlines lack the context that makes bias legible. Bias direction scores are more reliable for long-form pieces with clear editorial framing than for breaking news headlines.',
            },
          ].map(({ title, body }) => (
            <div key={title} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{title}</div>
              <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, margin: 0 }}>{body}</p>
            </div>
          ))}
        </Section>

        {/* Changelog */}
        <Section title="Changelog">
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.75, marginBottom: 20 }}>
            Every significant change to the scoring prompt, model, or weighting formula is logged here.
            If you notice a score shift that seems unexplained, check this first.
          </p>
          {CHANGELOG.map(({ date, entries }) => (
            <div key={date} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 10 }}>
                {date}
              </div>
              <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: 16 }}>
                {entries.map((e, i) => (
                  <div key={i} style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 8, display: 'flex', gap: 8 }}>
                    <span style={{ color: 'var(--text3)', flexShrink: 0 }}>—</span>
                    <span>{e}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Section>

        {/* Footer note */}
        <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 24, marginBottom: 40 }}>
          <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7 }}>
            Questions about the methodology or spotted something wrong?{' '}
            <a href="mailto:info@ratednews.com" style={{ color: 'var(--coral)', textDecoration: 'none' }}>
              Get in touch
            </a>
            . We update this page whenever the scoring system changes.
          </p>
        </div>

      </div>
    </div>
  )
}
