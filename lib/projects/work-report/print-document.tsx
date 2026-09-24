import { ProjectWorkReportView } from "@/components/obras/project-work-report-view"
import type { ProjectWorkReport } from "@/lib/projects/work-report/types"

type ProjectWorkReportPrintDocumentProps = {
  report: ProjectWorkReport
}

export function ProjectWorkReportPrintDocument({
  report,
}: ProjectWorkReportPrintDocumentProps) {
  return <ProjectWorkReportView report={report} variant="print" />
}
