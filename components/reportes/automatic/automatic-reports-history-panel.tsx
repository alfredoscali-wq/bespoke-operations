"use client"

import { useCallback, useEffect, useState } from "react"
import { Download, Eye, Mail, RefreshCw } from "lucide-react"

import { useDemoMode } from "@/components/demo/demo-mode-provider"
import { blockDemoWrite } from "@/lib/demo/demo-write-block"

import { Button } from "@/components/ui/button"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AutomaticReportHistoryEntryDto } from "@/lib/reports/automatic/client-types"
import type { WeeklyReportJobResultDto } from "@/lib/reports/automatic/client-types"
import {
  formatAutomaticReportTimestamp,
  resolveAutomaticReportHistoryStatusLabel,
} from "@/lib/reports/automatic/client-utils"

type HistoryResponse = {
  success: boolean
  items?: AutomaticReportHistoryEntryDto[]
  message?: string
}

type PdfResponse = {
  success: boolean
  signedUrl?: string
  fileName?: string | null
  message?: string
}

export function AutomaticReportsHistoryPanel() {
  const { isReadOnly, openRestrictedDialog } = useDemoMode()
  const [items, setItems] = useState<AutomaticReportHistoryEntryDto[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{
    variant: "success" | "error"
    message: string
  } | null>(null)

  const loadHistory = useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch("/api/reports/automatic/history")
      const payload = (await response.json()) as HistoryResponse

      if (payload.success && payload.items) {
        setItems(payload.items)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  async function fetchPdfUrl(id: string): Promise<PdfResponse> {
    const response = await fetch(`/api/reports/automatic/history/${id}/pdf`)
    return (await response.json()) as PdfResponse
  }

  async function handleView(id: string) {
    setActionId(id)
    setFeedback(null)

    try {
      const payload = await fetchPdfUrl(id)

      if (!payload.success || !payload.signedUrl) {
        throw new Error(payload.message ?? "No se pudo abrir el PDF.")
      }

      window.open(payload.signedUrl, "_blank", "noopener,noreferrer")
    } catch (error) {
      setFeedback({
        variant: "error",
        message:
          error instanceof Error ? error.message : "No se pudo abrir el PDF.",
      })
    } finally {
      setActionId(null)
    }
  }

  async function handleDownload(id: string) {
    setActionId(id)
    setFeedback(null)

    try {
      const payload = await fetchPdfUrl(id)

      if (!payload.success || !payload.signedUrl) {
        throw new Error(payload.message ?? "No se pudo descargar el PDF.")
      }

      const anchor = document.createElement("a")
      anchor.href = payload.signedUrl
      anchor.download = payload.fileName ?? "Bespoke-Weekly-Report.pdf"
      anchor.target = "_blank"
      anchor.rel = "noopener noreferrer"
      anchor.click()
    } catch (error) {
      setFeedback({
        variant: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo descargar el PDF.",
      })
    } finally {
      setActionId(null)
    }
  }

  async function handleResend(id: string) {
    if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
      return
    }

    setActionId(id)
    setFeedback(null)

    try {
      const response = await fetch(
        `/api/reports/automatic/history/${id}/resend`,
        { method: "POST" }
      )
      const payload = (await response.json()) as {
        success?: boolean
        result?: WeeklyReportJobResultDto
        message?: string
      }

      if (!payload.result?.pdfGenerated && !payload.success) {
        throw new Error(payload.message ?? "No se pudo reenviar el reporte.")
      }

      if (payload.result?.pdfGenerated && !payload.result.emailSent) {
        setFeedback({
          variant: "error",
          message:
            "No fue posible enviar el correo. El PDF fue generado correctamente.",
        })
      } else {
        setFeedback({
          variant: "success",
          message: payload.result?.message ?? "Reenviado correctamente.",
        })
      }

      await loadHistory()
    } catch (error) {
      setFeedback({
        variant: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo reenviar el reporte.",
      })
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="space-y-4">
      {feedback ? (
        <EntityActionFeedback variant={feedback.variant} message={feedback.message} />
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Destinatario</TableHead>
              <TableHead>Generado por</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No hay ejecuciones registradas.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const busy = actionId === item.id

                return (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatAutomaticReportTimestamp(item.generatedAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {resolveAutomaticReportHistoryStatusLabel(item)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.recipient || "—"}
                    </TableCell>
                    <TableCell className="text-sm">{item.generatedBy}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy || !item.pdfStoragePath}
                          onClick={() => void handleView(item.id)}
                          title="Ver"
                        >
                          {busy ? (
                            <RefreshCw className="size-4 animate-spin" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy || !item.pdfStoragePath}
                          onClick={() => void handleDownload(item.id)}
                          title="Descargar"
                        >
                          <Download className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy || !item.pdfStoragePath}
                          onClick={() => void handleResend(item.id)}
                          title="Reenviar"
                        >
                          <Mail className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
