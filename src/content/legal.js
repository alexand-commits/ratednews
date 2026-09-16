// Legal copy — the single source for both the footer modal and the crawlable
// /privacy and /terms pages.
//
// It lived inside LegalModal.jsx, which meant the only way to read the privacy
// policy was to open a React modal. There was no URL, so nothing was crawlable
// and an AdSense reviewer had nothing to find — a standard rejection cause.
// Splitting it out lets the modal and the pages render the SAME text; this
// project has already shipped one bug today from the same fact living in two
// places.

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
• **Google Analytics** and **Vercel Analytics** — page views and basic interaction events, used to understand which pages are read
• **Google AdSense** — serves the advertising that funds the site, and may set cookies as described below
• **Resend** — delivers the weekly email digest, if you subscribe
• **Google** — if you use Google Sign-In, Google processes your OAuth token

Article content is sourced from public RSS feeds. We do not share any of your personal data with news outlets.`,
    },
    {
      heading: 'Cookies and advertising',
      body: `• **Essential cookies** — a session token stored in a secure HTTP-only cookie, used to keep you signed in. You cannot opt out of this without logging out.
• **Analytics cookies** — we use Google Analytics and Vercel Analytics to understand which pages are read and how the site performs. These set cookies and record page requests.
• **Advertising cookies** — this site is supported by advertising. Google, as a third-party vendor, uses cookies to serve ads based on your prior visits to this and other websites. Google's use of advertising cookies enables it and its partners to serve ads to you based on your visit to this and/or other sites on the internet.

You may opt out of personalised advertising by visiting **Google Ads Settings** (adssettings.google.com), or opt out of third-party vendor cookies for personalised advertising at **aboutads.info/choices**.`,
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
  updated: '31 July 2026',
  sections: [
    {
      heading: 'Acceptance',
      body: `By accessing or using RatedNews ("the Service") you agree to be bound by these Terms. If you do not agree, please do not use the Service.`,
    },
    {
      heading: 'What RatedNews is',
      body: `RatedNews is a news aggregation service that indexes publicly available RSS feeds and lets registered users submit community ratings for news outlets. Every score on the Service is calculated from these reader ratings — RatedNews does not apply AI or editorial scoring to news content.

Scores are aggregated reader opinions, not editorial verdicts, and should not be treated as definitive fact-checks or endorsements.`,
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
      body: `The Service is provided "as is" without warranty of any kind. Community scores are aggregated reader opinions. They may not represent the broader public, can be affected by the composition of the rating audience, and may change at any time as new ratings arrive.

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
  updated: '31 July 2026',
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

Rate the journalism, not the politics. A left-leaning outlet can be accurate. A right-leaning outlet can produce quality journalism. Rate whether you trust the reporting — not whether you share the outlet's politics.`,
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
      body: `To protect against early manipulation, an outlet needs at least 3 community ratings before it holds a ranked position — below that, its score displays as provisional. Rating counts are shown wherever scores appear, so a score built on a handful of votes is always visible as such.`,
    },
    {
      heading: 'These guidelines evolve',
      body: `As the community grows, these guidelines will be updated to reflect new challenges. Substantive changes will be announced via email. Feedback is always welcome at info@ratednews.com.`,
    },
  ],
}

export const DOCS = { privacy: PRIVACY, terms: TERMS, guidelines: GUIDELINES }
export { PRIVACY, TERMS, GUIDELINES }
