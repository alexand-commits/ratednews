import React, { useState } from 'react'

const CATEGORIES = [
  { value: 'Politics',        emoji: '🏛',  label: 'Politics'        },
  { value: 'Business',        emoji: '📈',  label: 'Business'        },
  { value: 'Sport',           emoji: '⚽',  label: 'Sport'           },
  { value: 'Tech',            emoji: '💻',  label: 'Tech'            },
  { value: 'Science',         emoji: '🔬',  label: 'Science'         },
  { value: 'Health',          emoji: '🏥',  label: 'Health'          },
  { value: 'Environment',     emoji: '🌱',  label: 'Environment'     },
  { value: 'Entertainment',   emoji: '🎬',  label: 'Entertainment'   },
  { value: 'Crime',           emoji: '🔍',  label: 'Crime'           },
  { value: 'Travel',          emoji: '✈️',  label: 'Travel'          },
  { value: 'Education',       emoji: '🎓',  label: 'Education'       },
  { value: 'War & Conflict',  emoji: '⚔️',  label: 'War & Conflict'  },
  { value: 'Culture',         emoji: '🎨',  label: 'Culture'         },
  { value: 'World',           emoji: '🌍',  label: 'World'           },
]

const REGIONS = [
  { value: 'all', label: 'Global' },
  { value: 'US',  label: '🇺🇸 US' },
  { value: 'UK',  label: '🇬🇧 UK' },
  { value: 'int', label: '🌐 International' },
]

function getArticleRegion(article) {
  const country = article.outlets?.country || ''
  if (country === 'UK') return 'UK'
  if (country === 'US') return 'US'
  return 'int'
}

function guessCategory(article) {
  const text = ((article.title || '') + ' ' + (article.summary || '')).toLowerCase()
  if (/\b(sport|football|soccer|cricket|tennis|rugby|basketball|golf|olympic|formula|f1|match|league|player|team|coach|tournament|cup|championship|wicket|transfer|premier)\b/.test(text)) return 'Sport'
  if (/\b(election|government|parliament|minister|president|vote|policy|senate|congress|\bmp\b|political|party|labour|tory|conservative|democrat|republican|trump|chancellor)\b/.test(text)) return 'Politics'
  if (/\b(economy|market|stock|trade|company|bank|investment|gdp|inflation|financial|shares|profit|revenue|startup|business|earnings|interest rate|budget|recession)\b/.test(text)) return 'Business'
  if (/\b(\bai\b|artificial intelligence|technology|digital|cyber|\bapp\b|software|silicon|data breach|robot|computer|smartphone|social media|chatgpt|openai)\b/.test(text)) return 'Tech'
  if (/\b(cancer|disease|hospital|doctor|patient|surgery|treatment|vaccine|nhs|mental health|drug|medicine|clinical)\b/.test(text)) return 'Health'
  if (/\b(climate|environment|emission|carbon|pollution|wildlife|species|ocean|fossil fuel|renewable|net zero)\b/.test(text)) return 'Environment'
  if (/\b(research|study|space|nasa|science|planet|asteroid|discovery|experiment|physics|biology)\b/.test(text)) return 'Science'
  if (/\b(film|movie|music|celebrity|award|oscar|bafta|tv show|streaming|festival|album|actor|actress)\b/.test(text)) return 'Entertainment'
  if (/\b(war|conflict|military|troops|missile|bomb|battle|invasion|ceasefire|soldier|drone|strike|frontline|combat|siege|nato|warfare|armed forces)\b/.test(text)) return 'War & Conflict'
  if (/\b(crime|murder|arrest|police|court|sentence|prison|fraud|theft|shooting|trial)\b/.test(text)) return 'Crime'
  if (/\b(travel|tourism|flight|hotel|visa|destination|holiday|airport|airline)\b/.test(text)) return 'Travel'
  if (/\b(school|university|student|teacher|education|exam|degree|tuition|college|campus)\b/.test(text)) return 'Education'
  if (/\b(art|culture|museum|gallery|theatre|theater|literature|book|exhibition|heritage|architecture|fashion|design|cuisine|tradition)\b/.test(text)) return 'Culture'
  return 'World'
}

export default function CategoryPage({ articles, navigate, goBack }) {
  const [region, setRegion] = useState('all')

  // Filter by region first
  const regionFiltered = region === 'all'
    ? articles
    : articles.filter(a => getArticleRegion(a) === region)

  // Count articles per category within the region filter
  const counts = {}
  for (const a of regionFiltered) {
    const cat = a.category || guessCategory(a)
    counts[cat] = (counts[cat] || 0) + 1
  }

  return (
    <div className="page-content">
      <div className="container">
        <button className="back-btn" onClick={goBack}>← Back</button>

        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
            Categories
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>
            {regionFiltered.length} stories · tap a category to browse
          </p>
        </div>

        {/* Region filter */}
        <div className="filter-bar" style={{ marginBottom: 20 }}>
          {REGIONS.map(r => (
            <button
              key={r.value}
              className={`pill${region === r.value ? ' active' : ''}`}
              onClick={() => setRegion(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="category-grid">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              className="category-tile"
              onClick={() => navigate('feed', { category: c.value, region })}
            >
              <span className="category-tile-emoji">{c.emoji}</span>
              <span className="category-tile-label">{c.label}</span>
              <span className="category-tile-count">{counts[c.value] || 0} stories</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
