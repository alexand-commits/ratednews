#!/usr/bin/env node
// Section-outlet consolidation (26 Jul 2026) — repopulates parent_outlet_id
// so section feeds (BBC Politics, Guardian Sport, NYT World…) stay ingesting
// under their own byline but disappear from rankings/directory/compare/
// sitemap, which all already filter !parent_outlet_id. Brands that are
// genuinely distinct products (Sky Sports vs Sky News, ESPN Cricinfo,
// Politico Europe, CBS Sports) stay standalone.
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const MAP = {
  'BBC News': ['BBC World', 'BBC Politics', 'BBC Business', 'BBC Technology', 'BBC Science', 'BBC Health', 'BBC Entertainment', 'BBC Sport', 'BBC Sport Cricket', 'BBC Sport Football', 'BBC Sport Formula 1'],
  'The Guardian': ['Guardian World', 'Guardian Politics', 'Guardian Sport', 'Guardian Tech', 'Guardian Business', 'Guardian Culture', 'Guardian Science', 'Guardian Environment', 'Guardian US', 'Guardian Australia'],
  'Sky News': ['Sky News World', 'Sky News Politics', 'Sky News Business', 'Sky News Tech'],
  'Sky Sports': ['Sky Sports Football'],
  'New York Times': ['NYT World', 'NYT Politics', 'NYT Business', 'NYT Technology', 'NYT Science', 'NYT Health', 'NYT Arts'],
  'NPR': ['NPR World', 'NPR Politics'],
  'Fox News': ['Fox News World', 'Fox News Politics'],
  'The Independent': ['Independent World', 'Independent Sport', 'Independent Tech', 'Independent Business'],
  'The Local': ['The Local France', 'The Local Germany', 'The Local Italy', 'The Local Spain', 'The Local Sweden'],
}

const { data: outlets } = await db.from('outlets').select('id, name')
const byName = new Map(outlets.map(o => [o.name, o]))

// The Local has no parent outlet yet — create it with the network-wide feed
if (!byName.has('The Local')) {
  const { data, error } = await db.from('outlets').insert({
    name: 'The Local', country: 'Europe', type: 'Digital',
    rss_url: 'https://www.thelocal.com/feeds/rss.php',
    description: 'English-language news network covering nine European countries.',
  }).select().single()
  if (error) { console.log('ERR creating The Local:', error.message); process.exit(1) }
  byName.set('The Local', data)
  console.log('ADD  The Local (parent)')
}

let linked = 0
for (const [parentName, children] of Object.entries(MAP)) {
  const parent = byName.get(parentName)
  if (!parent) { console.log(`SKIP missing parent: ${parentName}`); continue }
  for (const childName of children) {
    const child = byName.get(childName)
    if (!child) { console.log(`SKIP missing child: ${childName}`); continue }
    const { error } = await db.from('outlets').update({ parent_outlet_id: parent.id }).eq('id', child.id)
    console.log(error ? `ERR  ${childName}: ${error.message}` : `LINK ${childName} → ${parentName}`)
    if (!error) linked++
  }
}
const { count } = await db.from('outlets').select('id', { count: 'exact', head: true }).is('parent_outlet_id', null)
console.log(`done — ${linked} sections linked; visible outlets now: ${count}`)
