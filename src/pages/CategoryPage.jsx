import React from 'react'

const CATEGORIES = [
  { value: 'Politics',      emoji: '🏛', label: 'Politics'     },
  { value: 'Business',      emoji: '📈', label: 'Business'     },
  { value: 'Sport',         emoji: '⚽', label: 'Sport'        },
  { value: 'Tech',          emoji: '💻', label: 'Tech'         },
  { value: 'Science',       emoji: '🔬', label: 'Science'      },
  { value: 'Health',        emoji: '🏥', label: 'Health'       },
  { value: 'Environment',   emoji: '🌱', label: 'Environment'  },
  { value: 'Entertainment', emoji: '🎬', label: 'Entertainment'},
  { value: 'Crime',         emoji: '⚖️', label: 'Crime'        },
  { value: 'Travel',        emoji: '✈️', label: 'Travel'       },
  { value: 'Education',     emoji: '🎓', label: 'Education'    },
  { value: 'World',         emoji: '🌍', label: 'World'        },
]

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
  if (/\b(crime|murder|arrest|police|court|sentence|prison|fraud|theft|attack|shooting|trial)\b/.test(text)) return 'Crime'
  if (/\b(travel|tourism|flight|hotel|visa|destination|holiday|airport|airline)\b/.test(text)) return 'Travel'
  if (/\b(school|university|student|teacher|education|exam|degree|tuition|college|campus)\b/.test(text)) return 'Education'
  return 'World'
}

export default function CategoryPage({ articles, navigate }) {
  // Count articles per category
  const counts = {}
  for (const a of articles) {
    const cat = a.category || guessCategory(a)
    counts[cat] = (counts[cat] || 0) + 1
  }

  return (
    <div className="page-content">
      <div className="container">
        <div className="section-label" style={{ marginBottom: 16 }}>Browse by category</div>
        <div className="category-grid">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              className="category-tile"
              onClick={() => navigate('feed', { category: c.value })}
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
