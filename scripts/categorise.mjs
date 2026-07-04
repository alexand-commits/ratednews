// Deterministic keyword categoriser — the single source of truth for article
// categories now that AI categorisation is gone. Used at ingest time (server)
// and mirrored on the client for any un-categorised stragglers.
//
// Canonical taxonomy (these exact labels are the category filter values):
//   Politics, World, Business, Tech, Science, Health, Environment, Sport,
//   Entertainment, Culture, Crime, Conflict, Travel, Education
//
// Order matters — the first rule that matches wins, so the most distinctive /
// specific categories are checked before the broad ones (World is the default).

export const CATEGORIES = [
  'Politics', 'World', 'Business', 'Tech', 'Science', 'Health',
  'Environment', 'Sport', 'Entertainment', 'Culture', 'Crime',
  'Conflict', 'Travel', 'Education',
]

const RULES = [
  ['Sport',        /\b(football|soccer|cricket|tennis|rugby|basketball|baseball|golf|olympic|formula ?1|\bf1\b|grand prix|premier league|champions league|world cup|nba|nfl|\bnhl\b|\bmlb\b|athletics|boxing|\bufc\b|wicket|touchdown|midfielder|striker|quarterback|marathon|wimbledon|super bowl|transfer window)\b/i],
  ['Conflict',     /\b(war|military|troops|missile|air ?strike|artillery|bombing|invasion|ceasefire|soldier|drone strike|front ?line|combat|siege|nato|warfare|armed forces|hostage|insurgent|militant|offensive|shelling|paramilitary)\b/i],
  ['Crime',        /\b(murder|homicide|manslaughter|arrest|arrested|police|court|sentenced|prison|jailed|fraud|theft|robbery|burglary|shooting|stabbing|trial|guilty|verdict|assault|kidnap|trafficking|convicted)\b/i],
  ['Health',      /\b(cancer|disease|hospital|\bdoctor|patient|surgery|treatment|vaccine|\bnhs\b|mental health|medicine|clinical|virus|outbreak|obesity|diabetes|dementia|pandemic|epidemic|infection|therapy)\b/i],
  ['Environment', /\b(climate|emission|carbon|pollution|wildlife|biodiversity|\bocean|fossil fuel|renewable|net zero|drought|flooding|wildfire|heat ?wave|deforestation|endangered|conservation|greenhouse)\b/i],
  ['Science',     /\b(research|study|\bspace\b|nasa|scientist|planet|asteroid|discovery|experiment|physics|biology|telescope|quantum|genome|particle|fossil|galaxy|spacecraft|\bmars\b)\b/i],
  ['Tech',        /\b(artificial intelligence|\bai\b|technolog|cyber|software|silicon valley|data breach|\brobot|smartphone|social media|chatgpt|openai|gadget|semiconductor|\bchip\b|crypto|bitcoin|hacker|algorithm|startup|\bapp\b)\b/i],
  ['Business',    /\b(econom|market|stock|shares|trade|company|\bbank|investment|\bgdp\b|inflation|financ|profit|revenue|earnings|interest rate|budget|recession|\bceo\b|\bipo\b|merger|acquisition|tariff|nasdaq|dow jones|wall street)\b/i],
  ['Entertainment', /\b(film|movie|music|celebrity|\baward|oscar|bafta|grammy|\btv show|streaming|festival|album|actor|actress|box office|netflix|hollywood|singer|\bband\b|concert|premiere|blockbuster)\b/i],
  ['Culture',     /\b(\bart\b|culture|museum|gallery|theatre|theater|literature|\bbook\b|exhibition|heritage|architecture|fashion|\bdesign\b|cuisine|tradition|sculpture|opera|ballet)\b/i],
  ['Travel',      /\b(travel|tourism|flight|\bhotel|\bvisa\b|destination|holiday|airport|airline|cruise|passport|vacation|resort|itinerary)\b/i],
  ['Education',   /\b(school|university|student|teacher|education|\bexam|degree|tuition|college|campus|ofsted|curriculum|graduate|scholarship)\b/i],
  ['Politics',    /\b(election|government|parliament|minister|president|\bsenate|congress|\bmp\b|policy|\bparty\b|labour|\btory\b|conservative|democrat|republican|trump|chancellor|prime minister|\bvote|referendum|diplomat|sanctions|white house|downing street|legislation|campaign)\b/i],
]

export function categorise(title = '', summary = '') {
  const text = `${title} ${summary}`.toLowerCase()
  for (const [cat, re] of RULES) {
    if (re.test(text)) return cat
  }
  return 'World'
}
