import React from 'react'

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
            How RatedNews works
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.75 }}>
            RatedNews is a community-powered news aggregator. We pull articles from 50+ outlets and let readers rate what they read.
            Every score you see comes from the community — no algorithms, no AI scoring.
          </p>
        </div>

        <Section title="What we aggregate">
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.75, marginBottom: 14 }}>
            RatedNews pulls articles from 50+ news outlets via RSS feeds, updated every 30 minutes. Articles are grouped by story
            so you can compare how different outlets cover the same event.
          </p>
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.75 }}>
            We ingest titles, summaries, images, and publication times. We don't fetch or process full article HTML — the article
            always opens on the publisher's own website.
          </p>
        </Section>

        <Section title="How article ratings work">
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.75, marginBottom: 16 }}>
            Any signed-in reader can rate an article once. Each rating captures four dimensions:
          </p>
          {[
            { label: 'Overall quality', desc: '1–5 stars. Your overall assessment of the article.' },
            { label: 'Accuracy', desc: 'Accurate / Mostly accurate / Inaccurate. How well the article represents the facts as you understand them.' },
            { label: 'Political bias', desc: 'Far left / Left / Centre / Right / Far right. The political framing of the article.' },
            { label: 'Headline quality', desc: 'Fair / Misleading / Clickbait. Whether the headline fairly represents the content.' },
          ].map(({ label, desc }) => (
            <div key={label} style={{ display: 'flex', gap: 14, marginBottom: 14, paddingBottom: 14, borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, minWidth: 130, color: 'var(--text)' }}>{label}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
          <Callout color="var(--amber)">
            Article ratings are reader perceptions, not verified facts. "Accurate" means the reader found it credible based on what they know — not that a fact-checker has verified every claim. Treat scores as community signals, not verdicts.
          </Callout>
        </Section>

        <Section title="How outlet ratings work">
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.75, marginBottom: 16 }}>
            Outlets can be rated independently of individual articles. Outlet ratings capture:
          </p>
          {[
            { label: 'Overall stars', desc: '1–5 stars. Your overall view of the outlet as a news source.' },
            { label: 'Accuracy', desc: 'How reliably accurate you find this outlet\'s reporting in general.' },
            { label: 'Political bias', desc: 'Your assessment of the outlet\'s general political lean.' },
          ].map(({ label, desc }) => (
            <div key={label} style={{ display: 'flex', gap: 14, marginBottom: 14, paddingBottom: 14, borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, minWidth: 130, color: 'var(--text)' }}>{label}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </Section>

        <Section title="How outlet scores are calculated">
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.75, marginBottom: 16 }}>
            An outlet's community score is the average star rating from all reader ratings, expressed out of 100
            (5 stars = 100, 1 star = 20). The rating count is always shown so you can judge the sample size yourself.
          </p>
          <Callout color="var(--blue)">
            An outlet with 3 ratings has a much less reliable score than one with 300. We show total ratings everywhere
            scores appear — a high score from a small sample should be taken with caution.
          </Callout>
        </Section>

        <Section title="Known limitations">
          <Callout color="var(--coral)">
            Publishing limitations is more useful than hiding them.
          </Callout>
          {[
            {
              title: 'Ratings reflect perception, not verified fact',
              body: 'A reader marking an article "Inaccurate" means they found it unconvincing — not that the claims have been independently fact-checked. Community ratings aggregate perception across many readers, which is valuable, but it\'s not the same as professional fact-checking.',
            },
            {
              title: 'Small sample sizes produce unreliable scores',
              body: 'An outlet or article with very few ratings can have a score that doesn\'t represent the broader readership. We display rating counts wherever scores appear so you can weigh the reliability yourself.',
            },
            {
              title: 'Reader demographics affect scores',
              body: 'If an outlet\'s readership skews heavily in one political direction, their ratings may reflect that. RatedNews has no control over who rates what. Treat community scores as a collective impression, not a ground truth.',
            },
            {
              title: 'Not all articles get rated',
              body: 'Most articles won\'t have any community ratings, especially newer ones. An article without ratings isn\'t a good or bad article — it just hasn\'t been rated yet.',
            },
          ].map(({ title, body }) => (
            <div key={title} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{title}</div>
              <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, margin: 0 }}>{body}</p>
            </div>
          ))}
        </Section>

<div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 24, marginBottom: 40 }}>
          <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7 }}>
            Questions about the methodology or spotted something wrong?{' '}
            <a href="mailto:info@ratednews.com" style={{ color: 'var(--coral)', textDecoration: 'none' }}>
              Get in touch
            </a>
            .
          </p>
        </div>

      </div>
    </div>
  )
}
