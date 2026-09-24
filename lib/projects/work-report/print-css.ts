import { readFileSync } from "node:fs"
import path from "node:path"

type TailwindCompiler = {
  build: (candidates: string[]) => string
}

const PRINT_CSS_CANDIDATES = [
  "pwr-report",
  "pwr-print",
  "pwr-cover",
  "pwr-summary",
  "pwr-orders-list",
  "pwr-work-order",
  "pwr-cover-meta",
  "pwr-kpis",
  "pwr-ot-meta",
  "pwr-gallery",
  "pwr-web-only",
  "pwr-print-only",
]

let compilerPromise: Promise<TailwindCompiler> | null = null

function extractCandidates(html: string): string[] {
  const fromClass = [...html.matchAll(/class="([^"]+)"/g)].flatMap((match) =>
    match[1].split(/\s+/).filter(Boolean)
  )
  return [...new Set([...fromClass, ...PRINT_CSS_CANDIDATES])]
}

async function getCompiler(): Promise<TailwindCompiler> {
  if (!compilerPromise) {
    const { compile } = await import("@tailwindcss/node")
    const root = process.cwd()
    const globals = readFileSync(path.join(root, "app/globals.css"), "utf8")
    const print = readFileSync(
      path.join(root, "components/obras/project-work-report-print.css"),
      "utf8"
    )
    compilerPromise = compile(`${globals}\n${print}`, {
      base: root,
      from: path.join(root, "app/globals.css"),
      onDependency() {},
    })
  }
  return compilerPromise
}

export async function compileProjectWorkReportCss(html: string): Promise<string> {
  const compiler = await getCompiler()
  return compiler.build(extractCandidates(html))
}
