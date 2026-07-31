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
]

// Framing splits inside a single story cluster — same event, competing labels.
// Only pairs/sets where the choice of word IS the editorial decision.
export const FRAMING_SETS = [
  { subject: 'unrest',    variants: ['protest', 'riot', 'unrest', 'demonstration'], res: [/\bprotest(?:s|ers?|ors?)?\b/i, /\briot(?:s|ers?|ing)?\b/i, /\bunrest\b/i, /\bdemonstrat(?:ions?|ors?)\b/i] },
  { subject: 'migration', variants: ['migrant', 'asylum seeker', 'refugee', 'illegal immigrant'], res: [/\bmigrants?\b/i, /\basylum[\s-]seekers?\b/i, /\brefugees?\b/i, /\billegal\s+(?:immigrants?|aliens?)\b/i] },
  { subject: 'violence',  variants: ['terrorist', 'gunman', 'attacker', 'militant'], res: [/\bterror(?:ists?|ism)?\b/i, /\bgun(?:man|men)\b/i, /\battackers?\b/i, /\bmilitants?\b/i] },
]
