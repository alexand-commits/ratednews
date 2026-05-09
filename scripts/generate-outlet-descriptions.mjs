#!/usr/bin/env node
/**
 * RatedNews — Outlet Description Generator
 * Usage: node scripts/generate-outlet-descriptions.mjs
 *
 * Fetches outlets with missing or short descriptions (<100 chars),
 * generates a 1–2 sentence SEO-optimised description for each via Claude,
 * and writes it back to the outlets table.
 *
 * Safe to re-run — skips any outlet that already has a description ≥ 100 chars.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env'), override: true })

const SUPABASE_URL      = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY')
  process.exit(1)
}

const supabase  = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

// Min description length before we consider it "good enough"
const MIN_DESC_LENGTH = 100

async function generateDescription(outletName, country) {
  const countryHint = country ? ` (${country})` : ''
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Write a factual, neutral 1–2 sentence description for the news outlet "${outletName}"${countryHint}.

Requirements:
- 120–155 characters total (this is used as an SEO meta description)
- Mention the outlet type (newspaper, broadcaster, wire service, magazine, etc.)
- Mention country/region of origin
- Mention editorial focus if notable (politics, business, sport, etc.)
- Do NOT include subjective praise or marketing language
- Do NOT start with "I" or "We"
- Do NOT use the outlet name as the very first word — start with the type or a brief phrase

Return ONLY the description text, nothing else.`,
    }],
  })

  const text = message.content[0]?.text?.trim() || ''
  return text
}

async function main() {
  console.log('Fetching outlets...')
  const { data: outlets, error } = await supabase
    .from('outlets')
    .select('id, name, country, description')
    .order('name')

  if (error) {
    console.error('Failed to fetch outlets:', error.message)
    process.exit(1)
  }

  const toUpdate = outlets.filter(o =>
    !o.description || o.description.trim().length < MIN_DESC_LENGTH
  )

  console.log(`Found ${outlets.length} outlets total`)
  console.log(`${toUpdate.length} need descriptions (missing or under ${MIN_DESC_LENGTH} chars)\n`)

  if (toUpdate.length === 0) {
    console.log('All outlets already have descriptions. Nothing to do.')
    return
  }

  let updated = 0
  let failed  = 0

  for (const outlet of toUpdate) {
    process.stdout.write(`  Generating: ${outlet.name}... `)
    try {
      const description = await generateDescription(outlet.name, outlet.country)

      if (!description || description.length < 50) {
        console.log(`⚠ too short (${description.length} chars), skipping`)
        failed++
        continue
      }

      const { error: updateError } = await supabase
        .from('outlets')
        .update({ description })
        .eq('id', outlet.id)

      if (updateError) {
        console.log(`✗ DB error: ${updateError.message}`)
        failed++
      } else {
        console.log(`✓ (${description.length} chars)`)
        console.log(`    "${description}"`)
        updated++
      }

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 300))
    } catch (err) {
      console.log(`✗ ${err.message}`)
      failed++
    }
  }

  console.log(`\nDone. Updated: ${updated} | Failed: ${failed}`)
}

main()
