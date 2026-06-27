import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const ROOT = path.resolve(import.meta.dirname, "..")
const SOURCE = path.join(ROOT, "public/images/logo/LOGO_BESPOKE.png")
const OUT_DIR = path.join(ROOT, "public/icons")

/** Fondo opaco — alineado con manifest background_color. */
const BACKGROUND = { r: 255, g: 255, b: 255 }

/**
 * Recorte cuadrado del emblema (esfera) del logo horizontal.
 * Fuente: 1024×378 — el símbolo ocupa el alto completo en el lado izquierdo.
 */
const EMBLEM_EXTRACT = {
  left: 0,
  top: 0,
  width: 378,
  height: 378,
}

const SIZES = [192, 256, 384, 512]
const MASKABLE_SIZES = [192, 512]
const APPLE_TOUCH_SIZE = 180
const FAVICON_SIZE = 32
const APP_ICON_SIZE = 512

async function loadEmblem() {
  return sharp(SOURCE).extract(EMBLEM_EXTRACT).png().toBuffer()
}

async function renderSquareIcon(emblem, size, { logoScale, maskable }) {
  const paddingRatio = maskable ? 0.2 : 0.08
  const inner = Math.round(size * (1 - paddingRatio * 2))

  const logo = await sharp(emblem)
    .resize(inner, inner, {
      fit: "contain",
      background: { ...BACKGROUND, alpha: 0 },
    })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: BACKGROUND,
    },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .flatten({ background: BACKGROUND })
    .removeAlpha()
    .png({ compressionLevel: 9, force: true })
    .toBuffer()
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const emblem = await loadEmblem()

  for (const size of SIZES) {
    const buffer = await renderSquareIcon(emblem, size, {
      logoScale: 1,
      maskable: false,
    })
    await writeFile(path.join(OUT_DIR, `icon-${size}x${size}.png`), buffer)
  }

  for (const size of MASKABLE_SIZES) {
    const buffer = await renderSquareIcon(emblem, size, {
      logoScale: 1,
      maskable: true,
    })
    await writeFile(
      path.join(OUT_DIR, `icon-maskable-${size}x${size}.png`),
      buffer
    )
  }

  const appleTouch = await renderSquareIcon(emblem, APPLE_TOUCH_SIZE, {
    logoScale: 1,
    maskable: false,
  })
  await writeFile(path.join(OUT_DIR, "apple-touch-icon.png"), appleTouch)

  const favicon = await sharp(emblem)
    .resize(FAVICON_SIZE, FAVICON_SIZE, {
      fit: "contain",
      background: { ...BACKGROUND, alpha: 0 },
    })
    .flatten({ background: BACKGROUND })
    .removeAlpha()
    .png({ force: true })
    .toBuffer()

  await writeFile(path.join(OUT_DIR, "favicon-32x32.png"), favicon)

  const appIcon = await renderSquareIcon(emblem, APP_ICON_SIZE, {
    logoScale: 1,
    maskable: false,
  })
  await writeFile(path.join(ROOT, "app/icon.png"), appIcon)

  console.log("PWA icons regenerated (emblem crop, opaque PNG).")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
