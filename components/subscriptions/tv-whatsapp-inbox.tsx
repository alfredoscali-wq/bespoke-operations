"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  allowedWhatsappRequestTransitions,
  WHATSAPP_REQUEST_STATUSES,
  whatsappRequestStatusLabel,
  type WhatsappCommercialRequest,
  type WhatsappRequestStatus,
} from "@/lib/subscriptions/whatsapp-commercial-requests"
import { formatTvMoney } from "@/lib/subscriptions/tv-plans"
import { FILTER_SELECT_TRIGGER_CLASS } from "@/lib/ui/visual-tokens"

const OFFER_LABEL = {
  basica: "TV Básica",
  pack: "TV Básica + Pack Fútbol",
  full: "TV Full",
} as const

type StatusFilter = WhatsappRequestStatus | "all"

export function TvWhatsappInbox({ canWrite }: { canWrite: boolean }) {
  const [status, setStatus] = useState<StatusFilter>("pending")
  const [items, setItems] = useState<WhatsappCommercialRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [nextStatus, setNextStatus] = useState<WhatsappRequestStatus | null>(null)
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const selected = items.find((item) => item.id === selectedId) ?? null

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetch(`/api/subscriptions/whatsapp-requests?status=${status}`)
      .then(async (response) => {
        const body = (await response.json()) as {
          success?: boolean
          message?: string
          items?: WhatsappCommercialRequest[]
        }
        if (!response.ok || !body.success || !body.items) {
          throw new Error(body.message || "No se pudieron cargar las solicitudes.")
        }
        return body.items
      })
      .then((next) => {
        if (cancelled) return
        setItems(next)
        setLoading(false)
      })
      .catch((loadError: unknown) => {
        if (cancelled) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar las solicitudes."
        )
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [status])

  useEffect(() => {
    setNextStatus(null)
    setNotes(selected?.operatorNotes ?? "")
  }, [selected])

  async function saveResolution() {
    if (!selected || !nextStatus) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/subscriptions/whatsapp-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus, operatorNotes: notes }),
      })
      const body = (await response.json()) as {
        success?: boolean
        message?: string
        item?: WhatsappCommercialRequest
      }
      if (!response.ok || !body.success || !body.item) {
        throw new Error(body.message || "No se pudo registrar la resolución.")
      }
      setItems((current) =>
        current.flatMap((item) => {
          if (item.id !== body.item?.id) return [item]
          if (status !== "all" && body.item.status !== status) return []
          return [body.item]
        })
      )
      setSelectedId(body.item.id)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo registrar la resolución."
      )
    } finally {
      setSaving(false)
    }
  }

  const transitions = selected ? allowedWhatsappRequestTransitions(selected.status) : []

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Solicitudes de WhatsApp</h2>
          <p className="text-xs text-muted-foreground">
            Completar una solicitud registra la decisión del operador. No cambia el plan en LATAM.
          </p>
        </div>
        <label className="space-y-1 text-xs text-muted-foreground">
          Estado
          <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
            <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {WHATSAPP_REQUEST_STATUSES.map((item) => (
                <SelectItem key={item} value={item}>
                  {whatsappRequestStatusLabel(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando solicitudes…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay solicitudes en este estado.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full flex-wrap items-center gap-3 px-3 py-2 text-left hover:bg-muted/40"
                onClick={() => setSelectedId(item.id)}
              >
                <span className="text-sm font-medium tabular-nums">{item.originPhone}</span>
                <span className="text-sm">{OFFER_LABEL[item.offer]}</span>
                <span className="text-xs text-muted-foreground">
                  {whatsappRequestStatusLabel(item.status)}
                </span>
                <span className="text-sm tabular-nums">
                  {item.quotedMonthlyFee == null
                    ? "Sin cotización verificada"
                    : formatTvMoney(item.quotedMonthlyFee)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <p>Teléfono {selected.originPhone}</p>
            <p>Oferta {OFFER_LABEL[selected.offer]}</p>
            <p>
              Identidad{" "}
              {selected.identityStatus === "verified"
                ? "verificada"
                : "no verificada"}
            </p>
            <p>
              Precio cotizado{" "}
              {selected.quotedMonthlyFee == null
                ? "sin cotización verificada"
                : formatTvMoney(selected.quotedMonthlyFee)}
            </p>
          </div>
          {selected.identityStatus === "unverified" ? (
            <p className="text-sm text-muted-foreground">
              El teléfono está compartido, duplicado o no identifica un único cliente. Quedó pendiente de verificación humana y no se muestran datos personales.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Cliente vinculado.</p>
          )}
          {selected.currentPlanLabel ? (
            <p className="text-sm">Plan actual: {selected.currentPlanLabel}</p>
          ) : null}
          {selected.destinationPlanLabel ? (
            <p className="text-sm">Plan destino: {selected.destinationPlanLabel}</p>
          ) : null}
          {selected.quotedComponents.length > 0 ? (
            <ul className="text-sm text-muted-foreground">
              {selected.quotedComponents.map((component) => (
                <li key={`${component.code}-${component.action}`}>
                  {component.code} · {component.action}
                  {component.unitPrice == null ? "" : ` · ${formatTvMoney(component.unitPrice)}`}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-sm">
            Marcar como completada guarda esta resolución. No ejecuta ningún cambio en LATAM.
          </p>
          {canWrite && transitions.length > 0 ? (
            <div className="space-y-2">
              <Select
                value={nextStatus ?? undefined}
                onValueChange={(value) => setNextStatus(value as WhatsappRequestStatus)}
              >
                <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                  <SelectValue placeholder="Elegir estado" />
                </SelectTrigger>
                <SelectContent>
                  {transitions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {whatsappRequestStatusLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Observación del operador"
              />
              <Button
                type="button"
                size="sm"
                disabled={saving || !nextStatus}
                onClick={() => void saveResolution()}
              >
                {saving ? "Guardando…" : "Registrar resolución"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
