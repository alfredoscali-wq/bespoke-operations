import { createRequire } from "node:module"

import { createElement, type ReactElement } from "react"

import { ProjectWorkReportPrintDocument } from "@/lib/projects/work-report/print-document"
import { compileProjectWorkReportCss } from "@/lib/projects/work-report/print-css"
import type { ProjectWorkReport } from "@/lib/projects/work-report/types"

const nodeRequire = createRequire(import.meta.url)

function renderToStaticMarkup(element: ReactElement): string {
  const reactDomServer = nodeRequire("react-dom/server") as {
    renderToStaticMarkup: (node: ReactElement) => string
  }
  return reactDomServer.renderToStaticMarkup(element)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

export function renderProjectWorkReportMarkup(
  report: ProjectWorkReport
): string {
  return renderToStaticMarkup(
    createElement(ProjectWorkReportPrintDocument, { report })
  )
}

export async function renderProjectWorkReportHtml(
  report: ProjectWorkReport
): Promise<string> {
  const markup = renderProjectWorkReportMarkup(report)
  const css = await compileProjectWorkReportCss(markup)
  const title = escapeHtml(
    `${report.cover.title} · ${report.cover.projectName}`
  )

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      html, body {
        margin: 0;
        background: var(--background);
        color: var(--foreground);
        font-family: ui-sans-serif, system-ui, "Segoe UI", Helvetica, Arial, sans-serif;
      }
      ${css}
    </style>
  </head>
  <body>
    ${markup}
  </body>
</html>`
}
