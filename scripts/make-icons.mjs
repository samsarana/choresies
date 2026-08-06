/**
 * Generates the Choresies PWA icons from assets/icon-source.png
 * (the ragdoll-with-a-vacuum). Run: npm run icons
 *
 * The source already carries icon-style padding, so every size is a plain
 * square resize. That padding also keeps the whole cat + vacuum inside a
 * launcher mask's inscribed circle, so the same image doubles as the
 * `maskable` icon (its rose background simply fills whatever the mask crops).
 * A composited safe-margin was tried and rejected: the source's subtle corner
 * vignette left a visible seam where the inset met the fill.
 */
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const SRC = new URL('../assets/icon-source.png', import.meta.url).pathname
const OUT = new URL('../public/icons/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

/** Plain resize of the full source to a square PNG. */
async function square(size, file) {
  await sharp(SRC).resize(size, size, { fit: 'cover' }).png().toFile(OUT + file)
  console.log('wrote', file)
}

await square(192, 'icon-192.png')
await square(512, 'icon-512.png')
await square(512, 'maskable-512.png')
await square(180, 'apple-touch-icon.png')
await square(64, 'favicon-64.png')
