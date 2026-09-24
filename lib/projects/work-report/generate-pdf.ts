import type { ProjectWorkReport } from "@/lib/projects/work-report/types"

export async function generateProjectWorkReportPdf(
  report: ProjectWorkReport
): Promise<Uint8Array> {
  const [{ renderProjectWorkReportHtml }, { printHtmlToPdf }] = await Promise.all([
    import("@/lib/projects/work-report/render-html"),
    import("@/lib/projects/work-report/print-html"),
  ])
  const html = await renderProjectWorkReportHtml(report)
  return printHtmlToPdf(html)
}
