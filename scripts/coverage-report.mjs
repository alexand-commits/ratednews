#!/usr/bin/env node
/**
 * Coverage Report — CLI/cron wrapper around the shared compute core.
 * Usage: node scripts/coverage-report.mjs   (Monday GH cron + manual)
 * The desk's "↻ Refresh data" button runs the SAME core via
 * /api/coverage-compute — this script is the scheduled backstop.
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { computeCoverageReport, storeCoverageReport } from '../src/server/coverage-compute.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env'), override: true })

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  console.log('📊 Coverage Report — computing…')
  const report = await computeCoverageReport(db)
  await storeCoverageReport(db, report)
  console.log(`this week: ${report.corpus.headlines.toLocaleString()} headlines · prior week: ${report.corpus.prevHeadlines.toLocaleString()}`)
  console.log(`stored. biggest story: "${report.attention.biggest?.story?.slice(0, 60)}" (${report.attention.biggest?.outlets} outlets)`)
  for (const g of report.language) {
    const top = g.terms[0]
    console.log(`${g.group}: '${top.term}' ${top.total} headlines (prev ${top.prevTotal}) — top: ${top.topOutlets.slice(0, 3).map(o => `${o.outlet} ${o.count}`).join(', ')}`)
  }
  console.log(`framing splits: ${report.framing.length} · first-to-report: ${report.attention.firstToReport.slice(0, 3).map(f => `${f.outlet} ${f.wins}`).join(', ')}`)
}

main().then(() => process.exit(0)).catch(err => { console.error('Fatal:', err); process.exit(1) })
