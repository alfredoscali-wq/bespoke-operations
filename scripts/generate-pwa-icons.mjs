import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const ROOT = path.resolve(import.meta.dirname, "..")
const SOURCE = path.join(ROOT, "public/images/logo/LOGO_BESPOKE.png")
const OUT_DIR = path.join(ROOT, "public/icons")

const SIZES = [192, 256, 384, 512]
const APPLE_TOUCH_SIZE = 180
const FAVICON_SIZE = 32

async function createSquareIcon(size, outputPath, maskable = false) {
  const padding = maskable ? Math.round(size * 0.1) : 0
  const inner = size - padding * 2

  const resized = await sharp(SOURCE)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: resized, gravity: "centre" }])
    .png()
    .toFile(outputPath)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  for (const size of SIZES) {
    await createSquareIcon(
      size,
      path.join(OUT_DIR, `icon-${size}x${size}.png`)
    )
  }

  await createSquareIcon(
    512,
    path.join(OUT_DIR, "icon-maskable-512x512.png"),
    true
  )

  await createSquareIcon(
    APPLE_TOUCH_SIZE,
    path.join(OUT_DIR, "apple-touch-icon.png")
  )

  const favicon = await sharp(SOURCE)
    .resize(FAVICON_SIZE, FAVICON_SIZE, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer()

  await writeFile(path.join(OUT_DIR, "favicon-32x32.png"), favicon)
  await writeFile(path.join(ROOT, "app/icon.png"), favicon)

  console.log("PWA icons generated in public/icons/ and app/icon.png")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
