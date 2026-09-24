"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { buildProjectWorkReportFileName } from "@/lib/projects/work-report/options"

type ProjectWorkReportPdfDownloadButtonProps = {
  endpoint: string
  body?: unknown
  fileName: string
}

async function triggerPdfDownload(
  response: Response,
  fileName: string
) {
  const contentType = response.headers.get("content-type") ?? ""
  if (!response.ok) {
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as { message?: string }
      throw new Error(payload.message ?? "No se pudo generar el PDF.")
    }
    throw new Error("No se pudo generar el PDF.")
  }

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as {
      signedUrl?: string
      fileName?: string
    }
    if (!payload.signedUrl) {
      throw new Error("No se pudo preparar la descarga del informe.")
    }
    const anchor = document.createElement("a")
    anchor.href = payload.signedUrl
    anchor.download = payload.fileName ?? fileName
    anchor.target = "_blank"
    anchor.rel = "noopener noreferrer"
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    return
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

export function ProjectWorkReportPdfDownloadButton({
  endpoint,
  body,
  fileName,
}: ProjectWorkReportPdfDownloadButtonProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      await triggerPdfDownload(
        response,
        fileName || buildProjectWorkReportFileName("obra")
      )
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo generar el PDF."
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={() => void handleClick()} disabled={busy}>
        {busy ? "Generando PDF..." : "Descargar PDF"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
