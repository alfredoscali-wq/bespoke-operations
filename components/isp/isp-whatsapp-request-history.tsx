"use client"

import { useEffect, useState } from "react"

import {
  whatsappRequestStatusLabel,
  type WhatsappRequestStatus,
} from "@/lib/subscriptions/whatsapp-commercial-requests"
import type { TvPlanKind } from "@/lib/subscriptions/tv-plan-coordination"
import { formatTvMoney } from "@/lib/subscriptions/tv-plans"

type HistoryItem = {
  id: string
  offer: TvPlanKind
  status: WhatsappRequestStatus
  quotedMonthlyFee: number | null
  currentPlanLabel: string | null
  destinationPlanLabel: string | null
  createdAt: string
}

const OFFER_LABEL: Record<TvPlanKind, string> = {
  basica: "TV Básica",
  pack: "TV Básica + Pack Fútbol",
  full: "TV Full",
}

export function IspWhatsappRequestHistory({ customerId }: { customerId: string }) {
  const [items, setItems] = useState<HistoryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch(`/api/isp/customers/${customerId}/whatsapp-requests`)
      .then(async (response) => {
        const body = (await response.json()) as {
          success?: boolean
          message?: string
          items?: HistoryItem[]
        }
        if (!response.ok || !body.success || !body.items) {
          throw new Error(body.message || "No se pudo cargar el historial de WhatsApp.")
        }
        return body.items
      })
      .then((next) => {
        if (!cancelled) setItems(next)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(cause instanceof Error ? cause.message : "No se pudo cargar el historial de WhatsApp.")
      })
    return () => {
      cancelled = true
    }
  }, [customerId])

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold">Solicitudes de WhatsApp</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Decisiones comerciales vinculadas a esta ficha. Los datos del cliente están en el resumen.
      </p>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {items == null && !error ? (
        <p className="mt-3 text-sm text-muted-foreground">Cargando solicitudes…</p>
      ) : null}
      {items && items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No hay solicitudes de WhatsApp vinculadas a esta ficha.
        </p>
      ) : null}
      {items && items.length > 0 ? (
        <ul className="mt-3 divide-y rounded-lg border">
          {items.map((item) => (
            <li key={item.id} className="space-y-1 px-3 py-2 text-sm">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>{formatWhen(item.createdAt)}</span>
                <span>{OFFER_LABEL[item.offer]}</span>
                <span className="text-muted-foreground">
                  {whatsappRequestStatusLabel(item.status)}
                </span>
                <span className="tabular-nums">
                  {item.quotedMonthlyFee == null
                    ? "Sin cotización verificada"
                    : formatTvMoney(item.quotedMonthlyFee)}
                </span>
              </div>
              {item.currentPlanLabel || item.destinationPlanLabel ? (
                <p className="text-xs text-muted-foreground">
                  {[item.currentPlanLabel, item.destinationPlanLabel].filter(Boolean).join(" → ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function formatWhen(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}
