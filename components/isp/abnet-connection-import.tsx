"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

type Preview = {
  sourceName: string
  valid: number
  invalid: number
  created: number
  updated: number
  unchanged: number
  issues: { rowNumber: number; reason: string }[]
}

export function AbnetConnectionImportPanel() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function send(mode: "preview" | "confirm") {
    if (!file) return
    setBusy(true)
    setMessage(null)
    try {
      const body = new FormData()
      body.set("file", file)
      const response = await fetch(`/api/isp/abnet-connections/import?mode=${mode}`, {
        method: "POST",
        body,
      })
      const payload = (await response.json()) as {
        success?: boolean
        message?: string
        preview?: Preview
      }
      if (payload.preview) setPreview(payload.preview)
      if (!response.ok || payload.success === false) {
        setMessage(payload.message || "No se pudo leer el archivo.")
        return
      }
      setMessage(
        mode === "confirm"
          ? "Padrón importado. Las conexiones que no venían en el archivo se conservaron."
          : "Previsualización lista. Todavía no se escribió nada."
      )
    } catch {
      setMessage("No se pudo contactar al servidor.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold">Padrón de conexiones ABNet</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Importá la hoja Datos de conexiones.xlsx. El archivo es una referencia comercial:
        no crea servicios, conexiones PPPoE ni llamadas a Latam.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".xlsx,.xls"
          aria-label="Archivo de conexiones ABNet"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null)
            setPreview(null)
            setMessage(null)
          }}
        />
        <Button type="button" variant="outline" disabled={!file || busy} onClick={() => send("preview")}>
          Previsualizar
        </Button>
        <Button
          type="button"
          disabled={!file || busy || !preview || preview.invalid > 0 || preview.valid === 0}
          onClick={() => send("confirm")}
        >
          Confirmar importación
        </Button>
      </div>
      {preview ? (
        <p className="mt-3 text-sm">
          {preview.valid} válidas · {preview.invalid} inválidas · {preview.created} nuevas ·{" "}
          {preview.updated} actualizaciones · {preview.unchanged} sin cambios. Origen:{" "}
          {preview.sourceName}.
        </p>
      ) : null}
      {preview && preview.issues.length > 0 ? (
        <ul className="mt-2 list-disc pl-5 text-xs text-destructive">
          {preview.issues.map((issue) => (
            <li key={`${issue.rowNumber}-${issue.reason}`}>
              Fila {issue.rowNumber}: {issue.reason}
            </li>
          ))}
        </ul>
      ) : null}
      {message ? <p className="mt-2 text-sm">{message}</p> : null}
    </section>
  )
}
