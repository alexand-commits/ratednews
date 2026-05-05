import sharp from 'sharp'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const svg = readFileSync(join(root, 'public/social-icon.svg'))

// 512x512 — master size for all social platforms
await sharp(svg)
  .resize(512, 512)
  .png({ quality: 100, compressionLevel: 9 })
  .toFile(join(root, 'public/social-icon.png'))

console.log('✓ social-icon.png (512×512)')
