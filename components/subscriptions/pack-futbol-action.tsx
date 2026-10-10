"use client"

import { useRef, useState } from "react"

import { useSubscriptions } from "@/components/subscriptions/subscriptions-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  canSubmitPackFutbolAssignment,
  interpretPackFutbolResponse,
  PACK_FUTBOL_ASSIGNMENT_DISABLED_MESSAGE,
  packFutbolQuotedFees,
} from "@/lib/subscriptions/pack-futbol"
import { formatTvMoney } from "@/lib/subscriptions/tv-plans"
import type { TvSubscriberRow } from "@/lib/types/subscriptions"

type PackFutbolQuote = {
  status: "available" | "already_active" | "assigned"
  packPrice: number
  currentMonthlyFee: number
  nextMonthlyFee: number
  conditionCode: string | null
  discountPercent: number | null
  assignmentEnabled?: boolean
}

const QUOTE_ERROR = "No se pudo calcular el Pack Fútbol."
const ASSIGN_ERROR = "No se pudo agregar Pack Fútbol."

export function PackFutbolAction({ row }: { row: TvSubscriberRow }) {
  const { canWrite, refreshDesk } = useSubscriptions()
  const [open, setOpen] = useState(false)
  const [quote, setQuote] = useState<PackFutbolQuote | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submittingRef = useRef(false)

  async function loadQuote() {
    setLoadingQuote(true)
    setError(null)
    setQuote(null)
    try {
      const response = await fetch(
        `/api/subscriptions/services/${row.serviceId}/pack-futbol`
      )
      const body = (await response.json()) as PackFutbolQuote & {
        success?: boolean
        message?: string
      }
      const outcome = interpretPackFutbolResponse({
        ok: response.ok,
        success: body.success,
        status: body.status,
        message: body.message,
        fallback: QUOTE_ERROR,
      })
      if (outcome.type === "error") {
        setError(outcome.message)
        return
      }
      setQuote(body)
      if (outcome.refresh) refreshDesk()
    } catch {
      setError(QUOTE_ERROR)
    } finally {
      setLoadingQuote(false)
    }
  }

  function onOpenChange(next: boolean) {
    if (submittingRef.current) return
    setOpen(next)
    if (next) void loadQuote()
  }

  async function confirm() {
    if (
      submittingRef.current ||
      !quote ||
      !canSubmitPackFutbolAssignment({
        assignmentEnabled: quote.assignmentEnabled === true,
        status: quote.status,
      })
    ) {
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/subscriptions/services/${row.serviceId}/pack-futbol`,
        { method: "POST" }
      )
      const body = (await response.json()) as PackFutbolQuote & {
        success?: boolean
        message?: string
      }
      const outcome = interpretPackFutbolResponse({
        ok: response.ok,
        success: body.success,
        status: body.status,
        message: body.message,
        fallback: ASSIGN_ERROR,
      })
      if (outcome.type === "error") {
        setError(outcome.message)
        return
      }
      setQuote(body)
      if (outcome.refresh) refreshDesk()
    } catch {
      setError(ASSIGN_ERROR)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  if (!canWrite || (!row.packFutbolEligible && !open)) return null

  const fees = quote ? packFutbolQuotedFees(quote) : null
  const assignmentEnabled = quote?.assignmentEnabled === true
  const canSubmit = quote
    ? canSubmitPackFutbolAssignment({
        assignmentEnabled,
        status: quote.status,
      })
    : false
  const finished =
    quote?.status === "assigned" || quote?.status === "already_active"
  const assignmentBlocked = quote != null && !assignmentEnabled

  return (
    <>
      {row.packFutbolEligible ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onOpenChange(true)}
        >
          Agregar Pack Fútbol
        </Button>
      ) : null}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Pack Fútbol</DialogTitle>
          </DialogHeader>
          {loadingQuote ? (
            <p className="text-sm text-muted-foreground">
              Cotizando el abono…
            </p>
          ) : fees ? (
            <div className="space-y-1 text-sm">
              <p>
                Abono actual:{" "}
                <span className="tabular-nums">
                  {formatTvMoney(fees.currentMonthlyFee)}
                </span>
              </p>
              <p>
                Precio mensual de Pack Fútbol:{" "}
                <span className="tabular-nums">
                  {formatTvMoney(fees.packMonthlyPrice)}
                </span>
              </p>
              <p className="font-medium">
                Nuevo total mensual:{" "}
                <span className="tabular-nums">
                  {formatTvMoney(fees.nextMonthlyFee)}
                </span>
              </p>
              {quote?.discountPercent != null && quote.discountPercent > 0 ? (
                <p className="pt-1 text-xs text-muted-foreground">
                  La condición {quote.conditionCode ?? "comercial"} del{" "}
                  {quote.discountPercent}% se aplica sobre el subtotal.
                </p>
              ) : null}
              {quote?.status === "assigned" ? (
                <p className="pt-2 text-sm">Pack Fútbol quedó activo.</p>
              ) : null}
              {quote?.status === "already_active" ? (
                <p className="pt-2 text-sm">
                  Este servicio ya tiene Pack Fútbol.
                </p>
              ) : null}
              {assignmentBlocked ? (
                <p className="pt-2 text-sm">
                  {PACK_FUTBOL_ASSIGNMENT_DISABLED_MESSAGE}
                </p>
              ) : null}
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            {finished || assignmentBlocked ? (
              <Button type="button" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            ) : (
              <Button
                type="button"
                disabled={loadingQuote || submitting || !canSubmit}
                onClick={() => void confirm()}
              >
                {submitting ? "Agregando…" : "Confirmar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
