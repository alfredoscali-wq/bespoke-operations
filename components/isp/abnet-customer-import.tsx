"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

type Preview = {
  sourceName: string
  valid: number
  invalid: number
  created: number
  updated: number
  review: number
  issues: { rowNumber: number; reason: string }[]
}

export function AbnetCustomerImportPanel() {
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
      const response = await fetch(`/api/isp/abnet-customers/import?mode=${mode}`, {
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
          ? "Datos personales importados. No se crearon fichas ni servicios técnicos."
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
      <h2 className="text-sm font-semibold">Datos personales ABNet</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Importá clientes.xlsx. El número de cliente vincula el domicilio y el DNI/CUIT
        con el padrón de conexiones. No crea fichas, servicios ni conexiones técnicas.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".xlsx,.xls"
          aria-label="Archivo de clientes ABNet"
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
          disabled={!file || busy || !preview || preview.valid === 0}
          onClick={() => send("confirm")}
        >
          Confirmar
        </Button>
      </div>
      {preview ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {preview.valid.toLocaleString("es-AR")} números · {preview.review.toLocaleString("es-AR")} para revisión ·{" "}
          {preview.invalid.toLocaleString("es-AR")} filas omitidas · {preview.created.toLocaleString("es-AR")} nuevos ·{" "}
          {preview.updated.toLocaleString("es-AR")} actualizaciones
        </p>
      ) : null}
      {preview?.issues.length ? (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
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
