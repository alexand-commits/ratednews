import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
for (const f of ['.env.local', '.env']) {
  if (!fs.existsSync(f)) continue
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const { computeCoverageReport } = await import('./src/server/coverage-compute.js')
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const t = Date.now()
const r = await computeCoverageReport(db)     // READ ONLY — not stored
const secs = Math.round((Date.now() - t) / 1000)
console.log(JSON.stringify({
  seconds: secs, vercelCapSeconds: 300, underCap: secs < 300,
  week: r.week, comparedWith: r.comparedWith,
  headlines: r.corpus.headlines, prevHeadlines: r.corpus.prevHeadlines,
  watchGroups: r.language.length,
  framingSplits: r.framing.length,
  completenessStories: r.completeness?.stories?.length ?? null,
  sampleWoW: r.language.flatMap(g => g.terms).filter(t => t.prevRate > 0).slice(0, 3)
    .map(t => `${t.term}: ${t.rate}/1k vs ${t.prevRate}/1k`),
}, null, 2))
