"use client"

import { useEffect, useState } from "react"
import { Download, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import type { WeeklyReportJobResultDto } from "@/lib/reports/automatic/client-types"
import {
  createWeeklyReportPreviewUrl,
  downloadWeeklyReportPdf,
} from "@/lib/reports/automatic/client-utils"

type WeeklyReportResultDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: WeeklyReportJobResultDto | null
  onResend: () => Promise<void>
  resending: boolean
}

export function WeeklyReportResultDialog({
  open,
  onOpenChange,
  result,
  onResend,
  resending,
}: WeeklyReportResultDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !result) {
      setPreviewUrl(null)
      return
    }

    if (result.pdfSignedUrl) {
      setPreviewUrl(result.pdfSignedUrl)
      return
    }

    if (result.pdfBase64) {
      const url = createWeeklyReportPreviewUrl(result.pdfBase64)
      setPreviewUrl(url)

      return () => {
        URL.revokeObjectURL(url)
      }
    }

    setPreviewUrl(null)
  }, [open, result?.pdfBase64, result?.pdfSignedUrl, result])

  const emailFailed = result?.pdfGenerated && !result.emailSent

  async function handleDownload() {
    if (!result) {
      return
    }

    if (result.pdfSignedUrl) {
      const anchor = document.createElement("a")
      anchor.href = result.pdfSignedUrl
      anchor.download = result.pdfFileName ?? "Bespoke-Weekly-Report.pdf"
      anchor.target = "_blank"
      anchor.rel = "noopener noreferrer"
      anchor.click()
      return
    }

    if (result.pdfBase64 && result.pdfFileName) {
      downloadWeeklyReportPdf({
        pdfBase64: result.pdfBase64,
        fileName: result.pdfFileName,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-4 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bespoke Weekly Report</DialogTitle>
          <DialogDescription>
            Reporte Semanal Operativo generado manualmente.
          </DialogDescription>
        </DialogHeader>

        {result && (
          <div className="space-y-4 overflow-y-auto">
            {emailFailed && (
              <EntityActionFeedback
                variant="error"
                message="No fue posible enviar el correo. El PDF fue generado correctamente."
              />
            )}

            {!emailFailed && result.emailSent && (
              <EntityActionFeedback
                variant="success"
                message="Reporte generado y enviado correctamente."
              />
            )}

            {previewUrl ? (
              <div className="overflow-hidden rounded-lg border bg-muted/30">
                <iframe
                  title="Vista previa del reporte semanal"
                  src={previewUrl}
                  className="h-[min(55vh,520px)] w-full"
                />
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(result?.pdfSignedUrl || result?.pdfBase64) && result?.pdfFileName ? (
              <Button type="button" variant="outline" onClick={() => void handleDownload()}>
                <Download className="size-4" />
                Descargar PDF
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={resending}
              onClick={() => void onResend()}
            >
              <Mail className="size-4" />
              {resending ? "Enviando..." : "Enviar por correo"}
            </Button>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
