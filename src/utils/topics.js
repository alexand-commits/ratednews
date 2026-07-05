// Shared trending-topic extraction — phrase-first proper-noun mining with
// outlet-diversity thresholds. Used by the homepage feed and Explore so both
// surfaces show the same quality of topics. Moved verbatim from FeedPage.

// capitalised-word PHRASES ("Donald Trump", "Supreme Court", "Gaza Strip")
// which are almost always genuine named entities. Single words are only shown
// when they're unambiguously proper (i.e. not in the common-word blocklist)
// and appear frequently enough to matter.

const COMMON_WORDS = new Set([
  // Articles & determiners (also in PHRASE_CONNECTORS but must be here too for isProperNoun guard)
  'the','a','an','this','that','these','those','every','each','any','all','some','no',
  // Pronouns
  'he','she','it','they','we','i','you','him','her','them','us','his','its','our','their',
  // Conjunctions & subordinators (including preposition-style headline starters)
  'but','and','or','nor','yet','so','if','unless','until','since','while','though',
  'although','because','whether','after','before','during','despite','without',
  'amid','following','regarding','concerning','pending','including','excluding',
  'across','beyond','within','between','among','against','along','around',
  // Common sentence-starters / adverbs
  'here','there','now','then','still','just','even','also','too','not','never',
  'always','often','again','already','only','very','quite','rather','more','most',
  // Modal / auxiliary verbs
  'may','might','must','can','will','shall','need','want','able',
  // Generic adjectives / determiners
  'new','old','big','small','great','major','key','top','full','long','short',
  'high','low','good','bad','best','worst','next','last','first','second','third',
  'final','early','late','real','true','false','main','chief','senior','junior',
  'former','young','recent','latest','another','other','less','many','few',
  'free','open','public','private','national','local','global','international',
  'further','several','same','own','right','left','both','such','certain',
  'hard','easy','clear','dark','light','fast','slow','hot','cold','safe',
  'huge','massive','rare','secret','hidden','historic','possible','impossible',
  // Generic nouns
  'prize','award','deal','plan','move','push','call','sign','vote','ban','bid',
  'plea','warning','threat','pledge','claim','claims','concerns','fears',
  'hopes','doubts','talks','crisis','issue','issues','case','cases',
  'step','steps','way','ways','time','times','year','years','day','days',
  'week','weeks','month','months','hour','hours','home','homes','house','houses','world',
  'nation','nations','state','states','city','cities','town','towns',
  'area','areas','region','regions','group','groups','party','parties',
  'street','streets','road','roads','building','buildings','office','offices',
  'people','man','woman','men','women','child','children','family','families',
  'leader','leaders','head','boss','official','officials','minister','ministers',
  'government','governments','court','courts','law','laws','rule','rules',
  'war','peace','fight','battle','death','deaths','life','lives',
  'money','cash','fund','funds','cost','costs','price','prices','tax','taxes',
  'shot','shots','fire','fires','attack','attacks','strike','strikes',
  // Sports event nouns — generic containers, not specific topics
  'cup','cups','league','leagues','trophy','trophies','title','titles',
  'fixture','fixtures','match','matches','game','games','tie','ties',
  'semi','final','finals','round','rounds','leg','legs','stage','stages',
  'season','seasons','tournament','tournaments','championship','championships',
  // Generic event nouns (describe type of event, not a specific named topic)
  'police','officer','officers','cop','cops','detective','detectives','sheriff',
  'hospital','hospitals','clinic','clinics','ambulance',
  'flood','floods','flooding','earthquake','storm','storms','hurricane','wildfire','wildfires',
  'shooting','shootings','stabbing','stabbings','explosion','explosions','blast','blasts',
  'protest','protests','protester','protesters','demonstrator','demonstrators','rally','rallies',
  'investigation','investigations','inquiry','inquiries','hearing','hearings','testimony',
  'rescue','rescued','evacuation','evacuations','emergency','emergencies','disaster','disasters',
  'election','elections','referendum','campaign','campaigns','candidate','candidates',
  'parliament','senate','congress','assembly','council','councils','committee','committees',
  'president','prime','premier','governor','governor','senator','senators','congressman',
  'company','companies','firm','firms','corporation','corporations','industry','sector',
  'market','markets','economy','recession','inflation','tariff','tariffs','sanction','sanctions',
  'school','schools','college','colleges','university','universities','student','students',
  'church','mosque','temple','synagogue','cathedral',
  // Common verbs
  'win','wins','won','lose','loses','lost','hit','hits','face','faces','back',
  'set','get','make','take','give','come','rise','fall','drop','cut','end',
  'stop','stops','stopped','start','begin','grow','reach','help','lead','leave','use','see','run',
  'hold','keep','bring','turn','say','says','said','show','shows','told',
  'call','calls','called','push','pushed','seek','seeks','sought',
  'join','joins','joined','open','opens','opened','close','closes','closed',
  'launch','launches','launched','announce','announces','announced',
  'reveal','reveals','revealed','confirm','confirms','confirmed',
  'deny','denies','denied','condemn','condemns','defend','defends',
  'warn','warns','warned','urge','urges','urged','slam','slams','slammed',
  'blast','blasts','blasted','slam','vow','vows','vowed','pledge','pledged',
  // Identity terms (standalone — too broad to be useful topics)
  'jews','jewish','muslims','christians','catholics','protestants',
  'blacks','whites','latinos','hispanics','asians','arabs',
  'immigrants','migrants','refugees','foreigners','natives',
  'gays','lesbians','trans','queer',
  // Common first names
  'john','james','mary','peter','paul','david','sarah','michael','george','robert',
  'william','richard','charles','donald','boris','tony','mark','chris','kevin','gary',
  'alan','nick','kate','emma','anna','lisa','jane','helen','laura','sophie','joe',
  'jack','harry','henry','oliver','emily','grace','alice','thomas','daniel','matthew',
  'andrew','joshua','ryan','adam','luke','alex','sam','ben','tom','tim','jim','bob',
  'bill','mike','phil','andy','dave','steve','sean','jake','liam','owen','evan',
  'neil','eric','carl','dean','rose','ruth','anne','june','dawn','amy','eva','mia',
  // UK tabloid tone/narrative words — describe mood, not topic; often start sentence-case headlines
  // e.g. "Fury as minister…", "Chaos in schools…", "Row over budget…", "Probe launched into…"
  'fury','chaos','row','rows','probe','probes','scandal','scandals','outrage','backlash',
  'shame','shock','blunder','blunders','snub','snubs','gaffe','gaffes','feud','feuds',
  'crisis','crises','drama','dramas','farce','fiasco','uproar','furore','furor',
  'fallout','aftermath','impact','impacts','effect','effects','consequence','consequences',
  'number',  // "Number 10" → strips to "Number", not a real topic
  // Overly broad geography — appear in too many headlines to signal a specific topic
  'london','britain','england','scotland','wales','ireland','europe','america',
  'africa','asia','australia','germany','france','italy','spain','canada',
  'china','russia','india','pakistan','ukraine','mexico','brazil','japan',
  'england','britain','uk','gb',  // UK/GB are 2 chars (already blocked by length) but listed for clarity
  // Generic news format words
  'analysis','opinion','comment','review','interview','exclusive','special','breaking',
  'update','report','reports','live','watch','listen','read','podcast','inside',
  'why','how','what','who','when','where','says','think','could','would','should',
  // ── Media / outlet words ──
  'news','network','channel','media','press','outlet','outlets','digital','online',
  'weekly','daily','tonight','today','morning','evening','sunday',
  'monday','tuesday','wednesday','thursday','friday','saturday',
  'reporter','reporters','anchor','correspondent','journalist',
  'editor','editors','spokesperson','spokesman','spokeswoman',
  'source','sources','bulletin','broadcast','programme','program',
])

// Known media outlet acronyms — blocked as both standalone topics and phrase anchors
const MEDIA_ACRONYMS = new Set([
  'cbs','nbc','cnn','bbc','abc','pbs','npr','msnbc','cnbc','itv','skynews',
  'afp','ap','upi','nhk','dw','rte','sbs','abc','sky','fox','rtc',
  'nyt','wsj','espn','hbo','hulu','vice','vox','axios','politico',
])

// Full names of TV anchors / journalists — blocked as trending phrases.
// They appear in headlines as interviewers, not as genuine news topics.
const BLOCKED_ANCHOR_PHRASES = new Set([
  // CBS
  'margaret brennan','norah odonnell','gayle king','tony dokoupil','john dickerson',
  // NBC / MSNBC
  'lester holt','savannah guthrie','hoda kotb','andrea mitchell','kristen welker',
  'mika brzezinski','joe scarborough','chris hayes','joy reid','ari melber',
  'ali velshi','rachel maddow','lawrence odonnell','nicolle wallace',
  // CNN
  'jake tapper','anderson cooper','wolf blitzer','erin burnett','dana bash',
  'poppy harlow','kate bolduan','abby phillip','brianna keilar','john berman',
  'jim sciutto','jim acosta','brian stelter','bianna golodryga','chris cuomo',
  'don lemon','omar jimenez',
  // Fox News
  'bret baier','martha maccallum','neil cavuto','harris faulkner',
  'ainsley earhardt','steve doocy','pete hegseth','jesse watters',
  'laura ingraham','sean hannity','tucker carlson','chris wallace','sandra smith',
  // ABC
  'george stephanopoulos','martha raddatz','david muir','robin roberts',
  'michael strahan','amy robach','gio benitez',
  // PBS / NPR
  'judy woodruff','gwen ifill','amna nawaz','geoff bennett',
  // BBC
  'huw edwards','sophie raworth','mishal husain','fiona bruce','andrew marr',
  'laura kuenssberg','victoria derbyshire',
  // Sky News
  'kay burley','dermot murnaghan','anna botting','adam boulton',
  // ITV
  'piers morgan','susanna reid','phillip schofield','holly willoughby',
  // Chuck Todd (NBC)
  'chuck todd',
])

// Anchor last names — suppresses singles like "Brennan" appearing alone
const ANCHOR_LAST_NAMES = new Set([
  'brennan','tapper','cooper','blitzer','lemon','maddow','hannity','carlson',
  'ingraham','cavuto','baier','maccallum','wallace','todd','stephanopoulos',
  'raddatz','muir','welker','holt','mitchell','brzezinski','scarborough',
  'hayes','reid','melber','velshi','guthrie','kotb','acosta','stelter',
  'burnett','bash','harlow','bolduan','keilar','berman','sciutto','golodryga',
  'faulkner','earhardt','doocy','watters','cuomo','dokoupil','dickerson',
  'woodruff','husain','kuenssberg','burley','murnaghan','nawaz','benitez',
  'strahan','robach','nawaz',
])

// Words that are generic adjectives in isolation but act as place-name prefixes
// when capitalized and followed by a proper noun (e.g. "New York", "North Korea",
// "West Bank", "Great Britain", "San Francisco", "Fort Worth", "Mount Everest").
// These are in COMMON_WORDS (so standalone "new/old/north/south" don't surface)
// but should NOT block phrase building when they appear capitalised mid-title.
const PLACE_PREFIXES = new Set([
  'new','old','north','south','east','west','central',
  'great','grand','upper','lower','inner','outer',
  'san','los','las','el','la','port','fort','mount','lake','cape',
  'saint','santa','sri','abu','al',
])

// Stop-words allowed to sit *inside* a phrase but not start/end one
const PHRASE_CONNECTORS = new Set(['of','the','and','in','on','at','to','for','by','with','from','over','into','as','a','de','da','del','van','von','le','la'])

export function computeTrendingTopics(topicsSource) {
    const phraseFreq   = {}
    const phraseOutlets = {}  // phrase key → Set of outlet_ids
    const singleFreq   = {}
    const singleOutlets = {}  // single key → Set of outlet_ids
    const displayForm  = {}

    // topicsSource: up to 1000 rows, title+outlet_id only — full 24h window
    for (const article of topicsSource.slice(0, 1000)) {
      const title = (article.title || '').trim()
      if (!title) continue
      const rawWords = title.split(/\s+/)

      // ── Pass 1: multi-word phrases ──
      let buffer = []

      const flushBuffer = () => {
        // Trim trailing connectors
        while (buffer.length && PHRASE_CONNECTORS.has(buffer[buffer.length - 1].key)) buffer.pop()
        // Trim leading connectors
        while (buffer.length && PHRASE_CONNECTORS.has(buffer[0].key)) buffer.shift()
        if (buffer.length < 2) { buffer = []; return }
        // Reject phrases containing a COMMON_WORDS token (e.g. "Major Plans", "Latest Deal"),
        // UNLESS that token is a PLACE_PREFIX — "New York", "North Korea", "San Francisco"
        // are valid phrases even though "new/north/san" are common words.
        const nonConnectors = buffer.filter(t => !PHRASE_CONNECTORS.has(t.key))
        if (nonConnectors.some(t => (COMMON_WORDS.has(t.key) && !PLACE_PREFIXES.has(t.key)) || MEDIA_ACRONYMS.has(t.key))) {
          buffer = []; return
        }
        const phrase    = buffer.map(t => t.word).join(' ')
        const phraseKey = phrase.toLowerCase()
        phraseFreq[phraseKey] = (phraseFreq[phraseKey] || 0) + 1
        if (!phraseOutlets[phraseKey]) phraseOutlets[phraseKey] = new Set()
        phraseOutlets[phraseKey].add(article.outlet_id)
        displayForm[phraseKey] = phrase
        buffer = []
      }

      rawWords.forEach((raw, idx) => {
        // Strip possessive 's first — "Balogun's" must merge with "Balogun",
        // not surface as the mangled plural "Baloguns"
        const clean = raw.replace(/['\u2019]s(?=\W|$)/, '').replace(/[^a-zA-Z'-]/g, '').replace(/^'+|'+$/g, '')
        if (!clean) { flushBuffer(); return }
        const isAcronym    = /^[A-Z]{2,6}$/.test(clean)
        const key0         = clean.toLowerCase()
        // A word is a proper noun if it starts with a capital letter AND is not a
        // common stop-word. Exception: capitalised PLACE_PREFIXES (New, North, San…)
        // are allowed into the buffer so "New York", "North Korea" etc. form correctly.
        // The flushBuffer check still rejects any phrase where a COMMON_WORDS term
        // is a non-connector, so "New deal" or "North facing" won't surface.
        const isPlacePrefix = /^[A-Z][a-z]+$/.test(clean) && PLACE_PREFIXES.has(key0)
        const isProperNoun  = /^[A-Z][a-z]{1,}$/.test(clean) && !COMMON_WORDS.has(key0) && !PHRASE_CONNECTORS.has(key0)
        const isConnector   = PHRASE_CONNECTORS.has(key0)
        if (isAcronym || isProperNoun || isPlacePrefix) {
          buffer.push({ word: isAcronym ? clean : clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase(), key: key0 })
        } else if (isConnector && buffer.length > 0) {
          buffer.push({ word: clean.toLowerCase(), key: clean.toLowerCase() })
        } else {
          flushBuffer()
        }
      })
      flushBuffer()

      // ── Pass 2: single proper nouns & acronyms ──
      rawWords.forEach((raw, idx) => {
        const clean = raw.replace(/['\u2019]s(?=\W|$)/, '').replace(/[^a-zA-Z]/g, '')
        if (!clean) return
        const isAcronym    = /^[A-Z]{2,6}$/.test(clean)
        const key          = clean.toLowerCase()
        const isProperNoun = /^[A-Z][a-z]{1,}$/.test(clean) && !COMMON_WORDS.has(key) && !PHRASE_CONNECTORS.has(key)
        if (!isAcronym && !isProperNoun) return
        if (key.length < 3) return
        if (COMMON_WORDS.has(key) || MEDIA_ACRONYMS.has(key)) return
        singleFreq[key] = (singleFreq[key] || 0) + 1
        if (!singleOutlets[key]) singleOutlets[key] = new Set()
        singleOutlets[key].add(article.outlet_id)
        if (!displayForm[key]) {
          displayForm[key] = isAcronym ? clean : clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase()
        }
      })
    }

    // Phrases ≥ 4 mentions across ≥ 2 outlets; singles ≥ 4 across ≥ 2 outlets.
    // Outlet diversity prevents tabloid clustering: 4 Sun articles about the same
    // celebrity story don't constitute a trending topic — real news spreads.
    const scored = {}
    for (const [key, count] of Object.entries(phraseFreq)) {
      if (
        count >= 4 &&
        (phraseOutlets[key]?.size ?? 0) >= 2 &&
        !BLOCKED_ANCHOR_PHRASES.has(key)
      ) scored[key] = count * 3
    }
    // Deduplicate singles against ALL extracted phrases (including blocked ones like
    // "margaret brennan") — otherwise blocking a phrase removes it from the dedup
    // set and lets the constituent first name slip through as a standalone topic.
    const allPhraseKeys = Object.keys(phraseFreq)
    for (const [key, count] of Object.entries(singleFreq)) {
      if (
        count >= 4 &&
        (singleOutlets[key]?.size ?? 0) >= 2 &&
        !scored[key] &&
        !allPhraseKeys.some(p => p.includes(key)) &&
        !ANCHOR_LAST_NAMES.has(key)
      ) {
        scored[key] = count
      }
    }

    return Object.entries(scored)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([key]) => displayForm[key] || key.charAt(0).toUpperCase() + key.slice(1))
}
