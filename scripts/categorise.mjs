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
  ['Sport',        /\b(football|soccer|cricket|tennis|rugby|basketball|baseball|golf|olympic|formula ?1|\bf1\b|grand prix|premier league|champions league|world cup|\bnba\b|\bnfl\b|\bnhl\b|\bmlb\b|athletics|boxing|\bufc\b|wicket|touchdown|midfielder|striker|quarterback|marathon|wimbledon|super bowl|transfer|tour de france|cycling|peloton|wallabies|all blacks|springboks|six nations|nations championship|grand slam|player ratings|test match|premiership|la liga|serie a|bundesliga|golfer|sprinter)\b/i],
  ['Conflict',     /\b(war|military|troops|missile|air ?strikes?|artillery|bombing|invasion|ceasefire|soldiers?|drone strikes?|front ?line|combat|siege|\bnato\b|warfare|armed forces|hostages?|insurgents?|militants?|offensive|shelling|paramilitary|ukraine|\bkyiv\b|zelensky|\bputin\b|\bgaza\b|\bhamas\b|hezbollah|\bidf\b|west bank|khamenei|houthi|militia)\b/i],
  ['Crime',        /\b(murder|homicide|manslaughter|arrests?|arrested|police|\bcourt\b|sentenced|prison|jailed|fraud|theft|robbery|burglary|shootings?|stabbings?|\btrial\b|guilty|verdict|assault|kidnap|trafficking|convicted|manhunt|felony)\b/i],
  ['Health',      /\b(cancer|diseases?|hospital|\bdoctor|patient|surgery|treatment|vaccine|\bnhs\b|mental health|\bhealth (risk|warning|scare|crisis|officials?)|medicine|clinical|\bvirus|outbreak|obesity|diabetes|dementia|pandemic|epidemic|infections?|therapy|measles|flu\b)\b/i],
  ['Environment', /\b(climate|emissions?|carbon|pollution|wildlife|biodiversity|\bocean|fossil fuel|renewable|net zero|drought|flooding|floods?|wildfires?|heat ?waves?|deforestation|endangered|conservation|greenhouse|earthquake|hurricane|typhoon|cyclone|tsunami)\b/i],
  ['Science',     /\b(research|\bstudy\b|\bspace\b|nasa|scientists?|planet|asteroid|discovery|experiment|physics|biology|telescope|quantum|genome|particle|fossil|galaxy|spacecraft|\bmars\b|\bmoon\b|satellite)\b/i],
  ['Tech',        /\b(artificial intelligence|\bai\b|technolog|cyber|software|silicon valley|data breach|\brobot|smartphone|social media|chatgpt|openai|gadget|semiconductor|\bchip\b|crypto|bitcoin|hacker|algorithm|startup|\bapp\b|data cent(er|re)|microsoft|google|apple|meta\b|tesla)\b/i],
  ['Business',    /\b(econom|markets?|stocks?|shares|\btrade\b|compan(y|ies)|\bbank|investment|\bgdp\b|inflation|financ|profit|revenue|earnings|interest rate|budget|recession|\bceo\b|\bipo\b|merger|acquisition|tariffs?|nasdaq|dow jones|wall street|jobs report|unemployment)\b/i],
  ['Entertainment', /\b(film|movie|music|celebrity|celebrities|\baward|oscar|bafta|grammy|\btv show|streaming|festival|album|actor|actress|box office|netflix|hollywood|singer|\bband\b|concert|premiere|blockbuster|taylor swift|wedding\b)\b/i],
  ['Culture',     /\b(\bart\b|culture|museum|gallery|theatre|theater|literature|\bbook\b|exhibition|heritage|architecture|fashion|\bdesign\b|cuisine|tradition|sculpture|opera|ballet|\bpope\b|royal family)\b/i],
  ['Travel',      /\b(travel|tourism|flights?|\bhotel|\bvisa\b|destination|holiday|airports?|airlines?|cruise|passport|vacation|resort|itinerary|national park|campground)\b/i],
  ['Education',   /\b(schools?|universit(y|ies)|students?|teachers?|education|\bexams?\b|degree|tuition|college|campus|ofsted|curriculum|graduate|scholarship)\b/i],
  ['Politics',    /\b(elections?|government|parliament|minister|president|\bsenate|senator|congress(man|woman)?|\bmp\b|policy|\bparty\b|labour|\btory\b|conservative|democrat|republican|trump|chancellor|prime minister|\bvote|referendum|diplomat|sanctions|white house|downing street|legislation|campaign|democracy|lawmaker|governor|impeach)\b/i],
]

export function categorise(title = '', summary = '') {
  const text = `${title} ${summary}`.toLowerCase()
  for (const [cat, re] of RULES) {
    if (re.test(text)) return cat
  }
  return 'World'
}
