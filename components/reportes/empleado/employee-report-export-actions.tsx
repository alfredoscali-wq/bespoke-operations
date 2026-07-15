"use client"

import { Printer, FileSpreadsheet, FileText } from "lucide-react"
import { useState } from "react"

import { useEmployeeReports } from "@/components/reportes/empleado/employee-reports-provider"
import { Button } from "@/components/ui/button"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import {
  EMPLOYEE_REPORT_PDF_FILE_NAME,
  EMPLOYEE_REPORT_XLSX_FILE_NAME,
  exportEmployeeIndividualReportPdf,
  exportEmployeeIndividualReportXlsx,
} from "@/lib/reports/employee-individual"

type ExportFormat = "xlsx" | "pdf"

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export function EmployeeReportExportActions() {
  const { report } = useEmployeeReports()
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [feedback, setFeedback] = useState<{
    variant: "success" | "error"
    message: string
  } | null>(null)

  async function handleExport(format: ExportFormat) {
    if (!report || exporting) {
      return
    }

    setExporting(format)
    setFeedback(null)

    try {
      const blob =
        format === "xlsx"
          ? await exportEmployeeIndividualReportXlsx(report)
          : await exportEmployeeIndividualReportPdf(report)

      downloadBlob(
        blob,
        format === "xlsx"
          ? `${EMPLOYEE_REPORT_XLSX_FILE_NAME}.xlsx`
          : `${EMPLOYEE_REPORT_PDF_FILE_NAME}.pdf`
      )

      setFeedback({
        variant: "success",
        message:
          format === "xlsx"
            ? "Excel descargado correctamente."
            : "PDF descargado correctamente.",
      })
    } catch (error) {
      console.error("[EMPLOYEE REPORT EXPORT]", error)
      setFeedback({
        variant: "error",
        message: "No fue posible exportar el reporte.",
      })
    } finally {
      setExporting(null)
    }
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={!report || exporting !== null}
          onClick={() => void handleExport("pdf")}
        >
          <FileText className="size-4" />
          {exporting === "pdf" ? "Exportando..." : "Exportar PDF"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={!report || exporting !== null}
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
          disabled={!report}
          onClick={handlePrint}
        >
          <Printer className="size-4" />
          Imprimir
        </Button>
      </div>

      <EntityActionFeedback
        message={feedback?.message ?? null}
        variant={feedback?.variant ?? "success"}
      />
    </div>
  )
}
