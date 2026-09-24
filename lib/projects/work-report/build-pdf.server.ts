import type { SupabaseClient } from "@supabase/supabase-js"

import { generateProjectWorkReportPdf } from "@/lib/projects/work-report/generate-pdf"
import {
  PROJECT_WORK_REPORT_EMPTY_MESSAGE,
  PROJECT_WORK_REPORT_LOAD_ERROR,
  loadProjectWorkReport,
  type ProjectWorkReportLoadResult,
} from "@/lib/projects/work-report/load-report.server"
import type { ProjectWorkReportOptions } from "@/lib/projects/work-report/options"
import type { ProjectWorkReport } from "@/lib/projects/work-report/types"
import type { Database } from "@/lib/supabase/database.types"

export type ProjectWorkReportBuildResult =
  | {
      ok: true
      fileName: string
      pdf: Uint8Array
      includedCount: number
      report: ProjectWorkReport
    }
  | Extract<ProjectWorkReportLoadResult, { ok: false }>

export async function buildProjectWorkReportPdfForCompany(input: {
  client: SupabaseClient<Database>
  companyId: string
  projectId: string
  options: ProjectWorkReportOptions
}): Promise<ProjectWorkReportBuildResult> {
  const loaded = await loadProjectWorkReport({
    ...input,
    photoMode: "embed",
  })

  if (!loaded.ok) {
    return loaded
  }

  if (loaded.report.workOrders.length === 0) {
    return {
      ok: false,
      status: 400,
      message: PROJECT_WORK_REPORT_EMPTY_MESSAGE,
    }
  }

  try {
    const pdf = await generateProjectWorkReportPdf(loaded.report)
    return {
      ok: true,
      fileName: loaded.fileName,
      pdf,
      includedCount: loaded.report.summary.includedCount,
      report: loaded.report,
    }
  } catch {
    return {
      ok: false,
      status: 500,
      message: PROJECT_WORK_REPORT_LOAD_ERROR,
    }
  }
}
