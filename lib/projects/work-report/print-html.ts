import { existsSync } from "node:fs"

import puppeteer from "puppeteer-core"

const LOCAL_CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
].filter((value): value is string => Boolean(value))

function isServerlessRuntime() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
}

function findLocalChrome(): string | null {
  return LOCAL_CHROME_CANDIDATES.find((candidate) => existsSync(candidate)) ?? null
}

async function resolveBrowserLaunch() {
  if (isServerlessRuntime()) {
    const chromium = (await import("@sparticuz/chromium")).default
    return {
      executablePath: await chromium.executablePath(),
      args: chromium.args,
    }
  }

  const executablePath = findLocalChrome()
  if (!executablePath) {
    throw new Error(
      "No se encontró Chrome/Chromium para generar el PDF del informe."
    )
  }

  return {
    executablePath,
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
  }
}

export async function printHtmlToPdf(html: string): Promise<Uint8Array> {
  const launch = await resolveBrowserLaunch()
  const browser = await puppeteer.launch({
    executablePath: launch.executablePath,
    args: launch.args,
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.emulateMediaType("print")
    await page.setContent(html, { waitUntil: "load" })
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((image) =>
          image.decode().catch(() => undefined)
        )
      )
    })
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    })
    return pdf
  } finally {
    await browser.close()
  }
}
