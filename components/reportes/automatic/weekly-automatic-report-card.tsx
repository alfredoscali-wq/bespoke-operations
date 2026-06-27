"use client"

import { useCallback, useEffect, useState } from "react"
import { Download, Mail, Play, RefreshCw } from "lucide-react"

import { useDemoMode } from "@/components/demo/demo-mode-provider"
import { blockDemoWrite } from "@/lib/demo/demo-write-block"

import { WeeklyReportResultDialog } from "@/components/reportes/automatic/weekly-report-result-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  WeeklyReportJobResultDto,
  WeeklyReportRunStatusDto,
} from "@/lib/reports/automatic/client-types"
import {
  formatAutomaticReportTimestamp,
  resolveAutomaticReportStatusLabel,
} from "@/lib/reports/automatic/client-utils"

type StatusResponse = {
  success: boolean
  status: WeeklyReportRunStatusDto | null
  message?: string
}

type RunResponse = {
  success: boolean
  result?: WeeklyReportJobResultDto
  message?: string
}

export function WeeklyAutomaticReportCard() {
  const { isReadOnly, openRestrictedDialog } = useDemoMode()
  const [status, setStatus] = useState<WeeklyReportRunStatusDto | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [running, setRunning] = useState(false)
  const [sending, setSending] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [lastResult, setLastResult] = useState<WeeklyReportJobResultDto | null>(
    null
  )
  const [downloading, setDownloading] = useState(false)
  const [feedback, setFeedback] = useState<{
    variant: "success" | "error"
    message: string
  } | null>(null)

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true)

    try {
      const response = await fetch("/api/reports/automatic/weekly/status")
      const payload = (await response.json()) as StatusResponse

      if (payload.success) {
        setStatus(payload.status)
      }
    } catch {
      setStatus(null)
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  async function handleGenerateNow() {
    if (running) {
      return
    }

    if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
      return
    }

    setRunning(true)
    setFeedback(null)

    try {
      const response = await fetch("/api/reports/automatic/weekly/run", {
        method: "POST",
      })
      const payload = (await response.json()) as RunResponse

      if (!payload.result) {
        throw new Error(payload.message ?? "No se pudo generar el reporte.")
      }

      setLastResult(payload.result)
      setDialogOpen(true)

      if (!payload.result.pdfGenerated) {
        setFeedback({
          variant: "error",
          message: payload.result.message,
        })
      } else if (!payload.result.emailSent) {
        setFeedback({
          variant: "error",
          message:
            "No fue posible enviar el correo. El PDF fue generado correctamente.",
        })
      }

      await loadStatus()
    } catch (error) {
      setFeedback({
        variant: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo generar el reporte.",
      })
    } finally {
      setRunning(false)
    }
  }

  async function handleSendNow() {
    if (sending) {
      return
    }

    if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
      return
    }

    setSending(true)
    setFeedback(null)

    try {
      const response = await fetch("/api/reports/automatic/weekly/send", {
        method: "POST",
      })
      const payload = (await response.json()) as RunResponse

      if (!payload.result?.pdfGenerated) {
        throw new Error(payload.message ?? payload.result?.message ?? "No se pudo enviar el reporte.")
      }

      if (!payload.result.emailSent) {
        setFeedback({
          variant: "error",
          message:
            "No fue posible enviar el correo. El PDF fue generado correctamente.",
        })
      } else {
        setFeedback({
          variant: "success",
          message: "Enviado correctamente.",
        })
      }

      await loadStatus()
    } catch (error) {
      setFeedback({
        variant: "error",
        message:
          error instanceof Error ? error.message : "No se pudo enviar el reporte.",
      })
    } finally {
      setSending(false)
    }
  }

  async function handleDownloadLatest() {
    if (downloading || !status?.latestHistoryId) {
      if (!status?.latestHistoryId) {
        setFeedback({
          variant: "error",
          message: "No hay un PDF disponible para descargar.",
        })
      }
      return
    }

    setDownloading(true)
    setFeedback(null)

    try {
      const response = await fetch(
        `/api/reports/automatic/history/${status.latestHistoryId}/pdf`
      )
      const payload = (await response.json()) as {
        success?: boolean
        signedUrl?: string
        fileName?: string | null
        message?: string
      }

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
      setDownloading(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Bespoke Weekly Report</CardTitle>
          <CardDescription>Reporte Semanal Operativo</CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4 sm:grid-cols-3">
          <StatusField
            label="Última ejecución"
            loading={loadingStatus}
            value={formatAutomaticReportTimestamp(status?.lastGeneratedAt)}
          />
          <StatusField
            label="Último envío"
            loading={loadingStatus}
            value={formatAutomaticReportTimestamp(status?.lastSentAt)}
          />
          <StatusField
            label="Estado"
            loading={loadingStatus}
            value={resolveAutomaticReportStatusLabel(status)}
          />
        </CardContent>

        <CardFooter className="flex flex-wrap items-center gap-2">
          <Button type="button" disabled={running} onClick={() => void handleGenerateNow()}>
            {running ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            {running ? "Generando..." : "Generar ahora"}
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={downloading || !status?.latestHistoryId}
            onClick={() => void handleDownloadLatest()}
          >
            {downloading ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {downloading ? "Descargando..." : "Descargar"}
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={sending}
            onClick={() => void handleSendNow()}
          >
            {sending ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Mail className="size-4" />
            )}
            {sending ? "Enviando..." : "Enviar ahora"}
          </Button>
        </CardFooter>
      </Card>

      {feedback ? (
        <EntityActionFeedback variant={feedback.variant} message={feedback.message} />
      ) : null}

      <WeeklyReportResultDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        result={lastResult}
        resending={sending}
        onResend={handleSendNow}
      />
    </>
  )
}

function StatusField({
  label,
  value,
  loading,
}: {
  label: string
  value: string
  loading: boolean
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {loading ? (
        <Skeleton className="h-5 w-40" />
      ) : (
        <p className="text-sm font-medium text-foreground">{value}</p>
      )}
    </div>
  )
}
