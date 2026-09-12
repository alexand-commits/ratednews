// Tracked-language watchlist for the Coverage Report. Each group is a set of
// competing terms for (roughly) the same subject — the interesting data is
// which outlets reach for which variant, and how usage moves week to week.
//
// Editorial rules for this list (keep them, they're the credibility):
// - Track SUBJECTS across the whole spectrum, never one outlet's pet words.
// - Variants within a group should be genuinely substitutable in a headline.
// - Counting is dumb on purpose: word-boundary regex over headlines, a
//   headline counts once per term no matter how often the term repeats.
export const WATCH_GROUPS = [
  {
    group: 'Migration',
    variants: [
      { label: 'migrant',           re: /\bmigrants?\b/i },
      { label: 'asylum seeker',     re: /\basylum[\s-]seekers?\b/i },
      { label: 'refugee',           re: /\brefugees?\b/i },
      { label: 'illegal immigrant', re: /\billegal\s+(?:immigrants?|aliens?)\b/i },
      { label: 'small boats',       re: /\bsmall\s+boats?\b/i },
    ],
  },
  {
    group: 'Civil unrest',
    variants: [
      { label: 'protest',        re: /\bprotest(?:s|ers?|ors?)?\b/i },
      { label: 'riot',           re: /\briot(?:s|ers?|ing)?\b/i },
      { label: 'unrest',         re: /\bunrest\b/i },
      { label: 'demonstration',  re: /\bdemonstrat(?:ions?|ors?)\b/i },
    ],
  },
  {
    group: 'Violence',
    variants: [
      { label: 'terrorist', re: /\bterror(?:ists?|ism)?\b/i },
      { label: 'gunman',    re: /\bgun(?:man|men)\b/i },
      { label: 'attacker',  re: /\battackers?\b/i },
      { label: 'militant',  re: /\bmilitants?\b/i },
      { label: 'shooter',   re: /\bshooters?\b/i },
    ],
  },
  {
    group: 'Intensity language',
    variants: [
      { label: 'crisis',   re: /\bcrisis\b/i },
      { label: 'chaos',    re: /\bchaos\b/i },
      { label: 'surge',    re: /\bsurges?\b/i },
      { label: 'invasion', re: /\binvasions?\b/i },
      { label: 'slams',    re: /\bslams?\b/i },
      { label: 'fury',     re: /\bfury\b/i },
    ],
  },
  // The four groups above are all conflict or migration. On their own they give
  // the report an argument it never intended to make — a page that counts only
  // that vocabulary reads as having a thesis, however scrupulous the counting,
  // and that undercuts the neutrality the whole thing trades on. The groups
  // below broaden it to economics, climate, labour, information and health, so
  // it reads as systematic rather than targeted. They also feed FRAMING_SETS,
  // which found exactly ONE split across 11,675 stories with only three sets.
  {
    group: 'Climate',
    variants: [
      { label: 'climate change',    re: /\bclimate\s+change\b/i },
      { label: 'global warming',    re: /\bglobal\s+warming\b/i },
      { label: 'climate crisis',    re: /\bclimate\s+crisis\b/i },
      { label: 'climate emergency', re: /\bclimate\s+emergency\b/i },
    ],
  },
  {
    group: 'Economic downturn',
    variants: [
      { label: 'recession',   re: /\brecessions?\b/i },
      { label: 'downturn',    re: /\bdownturns?\b/i },
      { label: 'slowdown',    re: /\bslowdowns?\b/i },
      { label: 'contraction', re: /\bcontractions?\b/i },
    ],
  },
  {
    group: 'Industrial action',
    variants: [
      { label: 'strike',            re: /\bstrikes?\b/i },
      { label: 'industrial action', re: /\bindustrial\s+action\b/i },
      { label: 'walkout',           re: /\bwalk[\s-]?outs?\b/i },
      { label: 'stoppage',          re: /\bstoppages?\b/i },
    ],
  },
  {
    group: 'False information',
    variants: [
      { label: 'misinformation', re: /\bmisinformation\b/i },
      { label: 'disinformation', re: /\bdisinformation\b/i },
      { label: 'fake news',      re: /\bfake\s+news\b/i },
      { label: 'propaganda',     re: /\bpropaganda\b/i },
    ],
  },
  {
    group: 'Assisted dying',
    variants: [
      { label: 'assisted dying',   re: /\bassisted\s+dying\b/i },
      { label: 'assisted suicide', re: /\bassisted\s+suicide\b/i },
      { label: 'euthanasia',       re: /\beuthanasia\b/i },
      { label: 'right to die',     re: /\bright[\s-]to[\s-]die\b/i },
    ],
  },
  {
    group: 'Abortion',
    variants: [
      { label: 'pro-life',        re: /\bpro[\s-]?life\b/i },
      { label: 'anti-abortion',   re: /\banti[\s-]?abortion\b/i },
      { label: 'pro-choice',      re: /\bpro[\s-]?choice\b/i },
      { label: 'abortion rights', re: /\babortion\s+rights\b/i },
    ],
  },
]

// Framing splits inside a single story cluster — same event, competing labels.
// Only pairs/sets where the choice of word IS the editorial decision.
export const FRAMING_SETS = [
  { subject: 'unrest',    variants: ['protest', 'riot', 'unrest', 'demonstration'], res: [/\bprotest(?:s|ers?|ors?)?\b/i, /\briot(?:s|ers?|ing)?\b/i, /\bunrest\b/i, /\bdemonstrat(?:ions?|ors?)\b/i] },
  { subject: 'migration', variants: ['migrant', 'asylum seeker', 'refugee', 'illegal immigrant'], res: [/\bmigrants?\b/i, /\basylum[\s-]seekers?\b/i, /\brefugees?\b/i, /\billegal\s+(?:immigrants?|aliens?)\b/i] },
  { subject: 'violence',  variants: ['terrorist', 'gunman', 'attacker', 'militant'], res: [/\bterror(?:ists?|ism)?\b/i, /\bgun(?:man|men)\b/i, /\battackers?\b/i, /\bmilitants?\b/i] },
  // Beyond conflict — same rule: only sets where the choice of word IS the
  // editorial decision, not a synonym anyone would pick at random. Three sets
  // yielded one split across a week of 11,675 stories; the bottleneck was this
  // list, not the data.
  { subject: 'climate',   variants: ['climate change', 'global warming', 'climate crisis', 'climate emergency'], res: [/\bclimate\s+change\b/i, /\bglobal\s+warming\b/i, /\bclimate\s+crisis\b/i, /\bclimate\s+emergency\b/i] },
  { subject: 'economy',   variants: ['recession', 'downturn', 'slowdown', 'contraction'], res: [/\brecessions?\b/i, /\bdownturns?\b/i, /\bslowdowns?\b/i, /\bcontractions?\b/i] },
  { subject: 'labour',    variants: ['strike', 'industrial action', 'walkout', 'stoppage'], res: [/\bstrikes?\b/i, /\bindustrial\s+action\b/i, /\bwalk[\s-]?outs?\b/i, /\bstoppages?\b/i] },
  { subject: 'information', variants: ['misinformation', 'disinformation', 'fake news', 'propaganda'], res: [/\bmisinformation\b/i, /\bdisinformation\b/i, /\bfake\s+news\b/i, /\bpropaganda\b/i] },
  { subject: 'assisted dying', variants: ['assisted dying', 'assisted suicide', 'euthanasia', 'right to die'], res: [/\bassisted\s+dying\b/i, /\bassisted\s+suicide\b/i, /\beuthanasia\b/i, /\bright[\s-]to[\s-]die\b/i] },
  { subject: 'abortion',  variants: ['pro-life', 'anti-abortion', 'pro-choice', 'abortion rights'], res: [/\bpro[\s-]?life\b/i, /\banti[\s-]?abortion\b/i, /\bpro[\s-]?choice\b/i, /\babortion\s+rights\b/i] },
]
