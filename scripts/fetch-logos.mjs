// Prep script (run manually, not in the app): downloads a 64px favicon for
// every domain in OUTLET_DOMAINS into public/logos/<domain>.png. Re-run this
// whenever you add outlets to src/components/OutletLogo.jsx — a new outlet with
// no local logo falls back to coloured initials until this repopulates it.
//
//   node scripts/fetch-logos.mjs
//
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = fs.readFileSync(path.join(ROOT, 'src/components/OutletLogo.jsx'), 'utf8')

// Only the OUTLET_DOMAINS block — don't scoop domains from overrides/comments.
const block = src.slice(src.indexOf('const OUTLET_DOMAINS'), src.indexOf('const LOGO_OVERRIDES'))
const domains = new Set()
for (const m of block.matchAll(/:\s*'([a-z0-9.-]+\.[a-z]{2,})'/g)) domains.add(m[1])

const list = [...domains].sort()
console.log(`Unique domains: ${list.length}`)

const outDir = path.join(ROOT, 'public/logos')
fs.mkdirSync(outDir, { recursive: true })

let ok = 0, fail = 0, tiny = 0
const failed = []
const CONCURRENCY = 8

async function one(domain) {
  const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
  try {
    const res = await fetch(url)
    if (!res.ok) { fail++; failed.push(`${domain} (HTTP ${res.status})`); return }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 120) tiny++ // Google returns a tiny generic globe when it has nothing
    fs.writeFileSync(path.join(outDir, `${domain}.png`), buf)
    ok++
  } catch (e) { fail++; failed.push(`${domain} (${e.message})`) }
}

const queue = [...list]
async function worker() { while (queue.length) await one(queue.shift()) }
await Promise.all(Array.from({ length: CONCURRENCY }, worker))

console.log(`Saved: ${ok}  Failed: ${fail}  Suspiciously-tiny: ${tiny}`)
if (failed.length) console.log('FAILURES:\n' + failed.join('\n'))
