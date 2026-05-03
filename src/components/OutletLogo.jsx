import React, { useState } from 'react'
import { outletColor, outletInitials } from '../utils/helpers'

const OUTLET_DOMAINS = {
  'BBC':              'bbc.co.uk',
  'BBC News':         'bbc.co.uk',
  'Reuters':          'reuters.com',
  'The Guardian':     'theguardian.com',
  'AP News':          'apnews.com',
  'AP New':           'apnews.com',
  'The Economist':    'economist.com',
  'New York Times':   'nytimes.com',
  'Washington Post':  'washingtonpost.com',
  'Fox News':         'foxnews.com',
  'Al Jazeera':       'aljazeera.com',
  'The Hill':         'thehill.com',
  'Politico':         'politico.com',
  'Sky News':         'news.sky.com',
  'Daily Mail':       'dailymail.co.uk',
  'CNN':              'cnn.com',
  'NBC News':         'nbcnews.com',
  'NPR':              'npr.org',
  'The Independent':  'independent.co.uk',
  'The Telegraph':    'telegraph.co.uk',
  'Breitbart':        'breitbart.com',
  'Vox':              'vox.com',
  'Financial Times':  'ft.com',
}

export default function OutletLogo({ name = '', size = 32, borderRadius = 8, style = {} }) {
  const [failed, setFailed] = useState(false)
  const domain = OUTLET_DOMAINS[name]
  const [bg, fg] = outletColor(name)

  const base = {
    width: size,
    height: size,
    borderRadius,
    flexShrink: 0,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...style,
  }

  if (domain && !failed) {
    return (
      <div style={{ ...base, background: bg }}>
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
          alt={name}
          onError={() => setFailed(true)}
          style={{ width: size * 0.65, height: size * 0.65, objectFit: 'contain' }}
        />
      </div>
    )
  }

  // Fallback: coloured initials
  return (
    <div style={{ ...base, background: bg, color: fg, fontSize: size * 0.3, fontWeight: 500 }}>
      {outletInitials(name || '?')}
    </div>
  )
}
