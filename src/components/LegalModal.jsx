import React, { useEffect } from 'react'

// ── Content ────────────────────────────────────────────────────────────────────

const PRIVACY = {
  title: 'Privacy Policy',
  updated: '5 May 2025',
  sections: [
    {
      heading: 'Who we are',
      body: `RatedNews is a news aggregation and media-rating service operated as a personal project. Our website is ratednews.com. You can contact us at info@ratednews.com with any privacy-related queries.`,
    },
    {
      heading: 'What data we collect',
      body: `We collect only what is necessary to provide the service:

• **Account data** — your email address and a hashed password when you register. You may also sign in via Google OAuth, in which case we receive your email address and public profile name only.
• **Usage data** — articles you save, outlets you follow, and outlet star ratings you submit. This is stored against your account so your preferences persist across devices.
• **Technical data** — standard server logs (IP address, browser type, page requests). These are retained for up to 30 days and used solely for security and debugging.

We do not collect payment information, phone numbers, or any form of government-issued ID.`,
    },
    {
      heading: 'How we use your data',
      body: `Your data is used exclusively to:

• Provide and personalise your feed and saved-article lists
• Remember outlet follows and community ratings you have submitted
• Send occasional product update emails if you opt in (you can unsubscribe at any time)
• Diagnose technical issues and prevent abuse

We do not sell, rent, or share your personal data with third parties for marketing purposes.`,
    },
    {
      heading: 'Third-party services',
      body: `We use the following sub-processors, each subject to their own privacy policies:

• **Supabase** (database and authentication) — EU-hosted infrastructure
• **Vercel** (web hosting and edge delivery) — processes request logs transiently
• **Google** — if you use Google Sign-In, Google processes your OAuth token

Article content is sourced from public RSS feeds. We do not share any of your personal data with news outlets.`,
    },
    {
      heading: 'Cookies',
      body: `We use only essential cookies required for authentication (a session token stored in a secure HTTP-only cookie). We do not use advertising cookies, tracking pixels, or third-party analytics cookies. You cannot opt out of the session cookie without logging out.`,
    },
    {
      heading: 'Your rights (GDPR)',
      body: `If you are based in the UK or EU you have the right to:

• **Access** — request a copy of the personal data we hold about you
• **Rectification** — correct inaccurate data
• **Erasure** — request deletion of your account and all associated data
• **Portability** — receive your data in a machine-readable format
• **Objection** — object to any processing you believe is unlawful

To exercise any of these rights, email info@ratednews.com. We will respond within 30 days.`,
    },
    {
      heading: 'Data retention',
      body: `Your account data is retained for as long as your account exists. If you delete your account, all associated data (saved articles, follows, ratings) is permanently deleted within 30 days. Anonymised, aggregated data (e.g. outlet score calculations) may be retained indefinitely as it cannot be linked back to you.`,
    },
    {
      heading: 'Changes to this policy',
      body: `We may update this policy occasionally. Significant changes will be communicated via the email address on your account. Continued use of the service after changes constitutes acceptance.`,
    },
  ],
}

const TERMS = {
  title: 'Terms of Service',
  updated: '5 May 2025',
  sections: [
    {
      heading: 'Acceptance',
      body: `By accessing or using RatedNews ("the Service") you agree to be bound by these Terms. If you do not agree, please do not use the Service.`,
    },
    {
      heading: 'What RatedNews is',
      body: `RatedNews is a news aggregation service that indexes publicly available RSS feeds and applies AI-generated scores to article headlines and summaries. It also allows registered users to submit community ratings for news outlets.

Scores are algorithmic signals, not editorial verdicts. They reflect patterns in language and framing and should not be treated as definitive fact-checks or endorsements.`,
    },
    {
      heading: 'Your account',
      body: `You must provide accurate information when creating an account. You are responsible for maintaining the security of your password and for all activity under your account. Notify us immediately at info@ratednews.com if you suspect unauthorised access.

You must be at least 13 years old to use the Service.`,
    },
    {
      heading: 'Acceptable use',
      body: `You agree not to:

• Attempt to manipulate outlet scores through fake accounts or coordinated voting
• Scrape or harvest the Service systematically without prior written permission
• Use the Service to harass, defame, or target any individual or group
• Attempt to reverse-engineer or circumvent any part of the platform
• Use automated tools to submit ratings or interact with the Service`,
    },
    {
      heading: 'Intellectual property',
      body: `The RatedNews name, logo, scoring methodology, and platform design are the property of RatedNews. Article content remains the property of the original publishers — we index headlines, summaries, and links only.

User-submitted ratings are licensed to RatedNews on a non-exclusive, royalty-free basis to display and use in aggregate score calculations.`,
    },
    {
      heading: 'Disclaimers',
      body: `The Service is provided "as is" without warranty of any kind. AI-generated scores are experimental signals based on publicly available text. They may contain errors, reflect model biases, or be inconsistent across similar articles.

RatedNews does not employ journalists, verify facts independently, or endorse the content of any linked publication. Always exercise your own judgement when consuming news.`,
    },
    {
      heading: 'Limitation of liability',
      body: `To the maximum extent permitted by law, RatedNews shall not be liable for any indirect, incidental, or consequential damages arising from your use of or inability to use the Service, including but not limited to reliance on any score or rating displayed.`,
    },
    {
      heading: 'Termination',
      body: `We reserve the right to suspend or terminate accounts that violate these Terms, at our sole discretion and without prior notice. You may delete your account at any time from your profile settings.`,
    },
    {
      heading: 'Governing law',
      body: `These Terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.`,
    },
    {
      heading: 'Changes',
      body: `We may revise these Terms at any time. Continued use of the Service after changes constitutes acceptance. We will notify registered users of material changes by email.`,
    },
  ],
}

const GUIDELINES = {
  title: 'Community Guidelines',
  updated: '5 May 2025',
  sections: [
    {
      heading: 'The spirit of RatedNews',
      body: `RatedNews exists to help people find trustworthy news — regardless of political leaning. Our community ratings work best when they reflect honest, considered assessments rather than political preferences or tribalism. Rate what you genuinely believe, not what you want others to think.`,
    },
    {
      heading: 'Rating fairly',
      body: `When rating an outlet, ask yourself:

• Does this outlet generally report facts accurately?
• Do they correct mistakes when they make them?
• Are their headlines fair and proportionate?
• Do they clearly distinguish news from opinion?

Rate the journalism, not the politics. A left-leaning outlet can be accurate. A right-leaning outlet can be credible. Partisan intensity is a separate score for a reason.`,
    },
    {
      heading: 'What we will not tolerate',
      body: `The following will result in account suspension or permanent removal:

• **Coordinated manipulation** — using multiple accounts, bots, or organising groups to inflate or deflate an outlet's score
• **Targeted harassment** — using the platform to organise campaigns against specific outlets, journalists, or communities
• **Hate speech** — submitting content or ratings motivated by race, religion, gender, sexuality, or any other protected characteristic
• **Misinformation** — deliberately spreading false claims about an outlet's ownership, funding, or editorial record`,
    },
    {
      heading: 'Reporting concerns',
      body: `If you believe an outlet's score has been manipulated, or you have evidence of coordinated abuse, please email info@ratednews.com with details. We review all reports and will act where the evidence warrants it.`,
    },
    {
      heading: 'Score integrity',
      body: `To protect against early manipulation, community ratings carry limited weight until an outlet accumulates 5 or more votes. At 20+ votes the community score reaches full weight. This means a handful of bad-faith ratings cannot meaningfully skew an outlet's overall score.`,
    },
    {
      heading: 'These guidelines evolve',
      body: `As the community grows, these guidelines will be updated to reflect new challenges. Substantive changes will be announced via email. Feedback is always welcome at info@ratednews.com.`,
    },
  ],
}

const DOCS = { privacy: PRIVACY, terms: TERMS, guidelines: GUIDELINES }

// ── Renderer ───────────────────────────────────────────────────────────────────

function renderBody(text) {
  // Convert **bold** and bullet lines into styled elements
  return text.split('\n').map((line, i) => {
    if (line.startsWith('•')) {
      const content = line.slice(1).trim()
      return (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <span style={{ color: 'var(--coral)', flexShrink: 0, marginTop: 1 }}>•</span>
          <span>{renderInline(content)}</span>
        </div>
      )
    }
    if (!line.trim()) return <div key={i} style={{ height: 8 }} />
    return <p key={i} style={{ margin: '0 0 4px' }}>{renderInline(line)}</p>
  })
}

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────────

export default function LegalModal({ doc, onClose }) {
  const content = DOCS[doc]

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (!content) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 0 0',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxWidth: 680,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        }}
      >
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 24px 12px',
          borderBottom: '0.5px solid var(--border)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'Playfair Display, serif' }}>
              {content.title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              Last updated {content.updated}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg)', border: 'none', borderRadius: '50%',
              width: 32, height: 32, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: 'var(--text2)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '20px 24px 40px', fontSize: 13, lineHeight: 1.7, color: 'var(--text2)' }}>
          {content.sections.map((s, i) => (
            <div key={i} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                {s.heading}
              </div>
              <div>{renderBody(s.body)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
