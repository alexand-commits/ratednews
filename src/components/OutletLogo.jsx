import React, { useState } from 'react'
import { outletColor, outletInitials } from '../utils/helpers'

const OUTLET_DOMAINS = {
  // UK
  'BBC':                      'bbc.co.uk',
  'BBC News':                 'bbc.co.uk',
  'The Guardian':             'theguardian.com',
  'The Telegraph':            'telegraph.co.uk',
  'The Independent':          'independent.co.uk',
  'Sky News':                 'news.sky.com',
  'Daily Mail':               'dailymail.co.uk',
  'Financial Times':          'ft.com',
  'The Sun':                  'thesun.co.uk',
  'Metro':                    'metro.co.uk',
  'Evening Standard':         'standard.co.uk',
  'The Spectator':            'spectator.co.uk',
  'New Statesman':            'newstatesman.com',
  'The Times':                'thetimes.com',
  'The Mirror':               'mirror.co.uk',
  'iNews':                    'inews.co.uk',
  'Channel 4 News':           'channel4.com',
  'GB News':                  'gbnews.com',
  'Daily Express':            'express.co.uk',
  // US
  'Reuters':                  'reuters.com',
  'AP News':                  'apnews.com',
  'AP New':                   'apnews.com',
  'New York Times':           'nytimes.com',
  'Washington Post':          'washingtonpost.com',
  'Fox News':                 'foxnews.com',
  'CNN':                      'cnn.com',
  'NBC News':                 'nbcnews.com',
  'NPR':                      'npr.org',
  'The Hill':                 'thehill.com',
  'Politico':                 'politico.com',
  'Breitbart':                'breitbart.com',
  'Vox':                      'vox.com',
  'The Economist':            'economist.com',
  'The Atlantic':             'theatlantic.com',
  'Newsweek':                 'newsweek.com',
  'HuffPost':                 'huffpost.com',
  'National Review':          'nationalreview.com',
  'Time':                     'time.com',
  'USA Today':                'usatoday.com',
  'The Daily Beast':          'thedailybeast.com',
  'Wall Street Journal':      'wsj.com',
  'Bloomberg':                'bloomberg.com',
  'New York Post':            'nypost.com',
  'CBS News':                 'cbsnews.com',
  'ABC News':                 'abcnews.go.com',
  'Axios':                    'axios.com',
  'MSNBC':                    'msnbc.com',
  'Business Insider':         'businessinsider.com',
  // International — existing
  'Al Jazeera':               'aljazeera.com',
  'Deutsche Welle':           'dw.com',
  'France 24':                'france24.com',
  'ABC News Australia':       'abc.net.au',
  'CBC News':                 'cbc.ca',
  'South China Morning Post': 'scmp.com',
  'Times of India':           'timesofindia.com',
  // International — new
  'Euronews':                 'euronews.com',
  'Le Monde':                 'lemonde.fr',
  'Der Spiegel':              'spiegel.de',
  'El País':                  'elpais.com',
  'Irish Times':              'irishtimes.com',
  'RTÉ News':                 'rte.ie',
  'Haaretz':                  'haaretz.com',
  'The Jerusalem Post':       'jpost.com',
  'Arab News':                'arabnews.com',
  'The Japan Times':          'japantimes.co.jp',
  'NHK World':                'nhk.or.jp',
  'Nikkei Asia':              'asia.nikkei.com',
  'The Straits Times':        'straitstimes.com',
  'Sydney Morning Herald':    'smh.com.au',
  'Kyiv Independent':         'kyivindependent.com',
  'The Moscow Times':         'themoscowtimes.com',
  'The Globe and Mail':       'theglobeandmail.com',
  'CNBC':                     'cnbc.com',
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
