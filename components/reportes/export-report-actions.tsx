"use client"

import { useState } from "react"
import { FileSpreadsheet, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import {
  exportManagementReportPdf,
  MANAGEMENT_REPORT_PDF_FILE_NAME,
} from "@/lib/reports/export-management-report-pdf"
import {
  exportManagementReportXlsx,
  MANAGEMENT_REPORT_XLSX_FILE_NAME,
} from "@/lib/reports/export-management-report-xlsx"
import type { ManagementReport } from "@/lib/reports/management-report"

export interface ExportReportActionsProps {
  report: ManagementReport
}

type ExportFormat = "xlsx" | "pdf"

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export function ExportReportActions({ report }: ExportReportActionsProps) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [feedback, setFeedback] = useState<{
    variant: "success" | "error"
    message: string
  } | null>(null)

  async function handleExport(format: ExportFormat) {
    if (exporting) {
      return
    }

    setExporting(format)
    setFeedback(null)

    try {
      const blob =
        format === "xlsx"
          ? await exportManagementReportXlsx(report)
          : await exportManagementReportPdf(report)

      downloadBlob(
        blob,
        format === "xlsx"
          ? `${MANAGEMENT_REPORT_XLSX_FILE_NAME}.xlsx`
          : `${MANAGEMENT_REPORT_PDF_FILE_NAME}.pdf`
      )

      setFeedback({
        variant: "success",
        message:
          format === "xlsx"
            ? "Reporte Gerencial.xlsx descargado correctamente."
            : "Reporte Gerencial.pdf descargado correctamente.",
      })
    } catch (error) {
      console.error("[MANAGEMENT REPORT EXPORT]", error)
      setFeedback({
        variant: "error",
        message: "No fue posible exportar el reporte. Intente nuevamente.",
      })
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={exporting !== null}
          onClick={() => void handleExport("xlsx")}
        >
          <FileSpreadsheet className="size-4" />
          {exporting === "xlsx" ? "Exportando..." : "Exportar Excel"}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={exporting !== null}
          onClick={() => void handleExport("pdf")}
        >
          <FileText className="size-4" />
          {exporting === "pdf" ? "Exportando..." : "Exportar PDF"}
        </Button>
      </div>

      <EntityActionFeedback
        message={feedback?.message ?? null}
        variant={feedback?.variant ?? "success"}
      />
    </div>
  )
}
