"use client"

import { useEffect, useMemo, useState } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import {
  formatCustomerRetencionMotivoBajaLabel,
  formatCustomerRetencionResultadoLabel,
  formatCustomerRetencionStatusLabel,
  getCustomerRetencionResultadoTone,
  getCustomerRetencionStatusTone,
} from "@/lib/customer-retenciones/format"
import type { CustomerRetencionSupervisionRow } from "@/lib/types/customer-retenciones"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { STATUS_BADGE_BASE, STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

type RetencionViewDialogProps = {
  retencionId: string | null
  listRow: CustomerRetencionSupervisionRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function RetencionStatusBadge({
  status,
}: {
  status: CustomerRetencionSupervisionRow["status"]
}) {
  const tone = getCustomerRetencionStatusTone(status)

  return (
    <Badge
      variant="outline"
      className={cn(STATUS_BADGE_BASE, STATUS_TONE_STYLES[tone])}
    >
      {formatCustomerRetencionStatusLabel(status)}
    </Badge>
  )
}

function RetencionResultadoBadge({
  resultado,
}: {
  resultado: NonNullable<CustomerRetencionSupervisionRow["resultado"]>
}) {
  const tone = getCustomerRetencionResultadoTone(resultado)

  return (
    <Badge
      variant="outline"
      className={cn(STATUS_BADGE_BASE, STATUS_TONE_STYLES[tone])}
    >
      {formatCustomerRetencionResultadoLabel(resultado)}
    </Badge>
  )
}

export function RetencionViewDialog({
  retencionId,
  listRow,
  open,
  onOpenChange,
}: RetencionViewDialogProps) {
  const {
    fetchRetencionById,
    canMarkRetencionReadyForRetiro,
    markRetencionReadyForRetiro,
  } = useAtencionCliente()
  const [displayRow, setDisplayRow] = useState<CustomerRetencionSupervisionRow | null>(
    listRow
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDisplayRow(listRow)
  }, [listRow])

  useEffect(() => {
    if (!open || !retencionId || !listRow) {
      return
    }

    let cancelled = false
    const currentListRow = listRow
    const currentRetencionId = retencionId

    async function loadLatest() {
      setIsLoading(true)

      const retencion = await fetchRetencionById(currentRetencionId)
      if (!cancelled && retencion) {
        setDisplayRow({
          ...currentListRow,
          detail: retencion.detail,
          status: retencion.status,
          resultado: retencion.resultado ?? null,
          resolution: retencion.resolution ?? null,
          completedAt: retencion.completedAt ?? null,
          administrationPendingAt: retencion.administrationPendingAt ?? null,
        })
      }

      if (!cancelled) {
        setIsLoading(false)
      }
    }

    void loadLatest()

    return () => {
      cancelled = true
    }
  }, [fetchRetencionById, listRow, open, retencionId])

  useEffect(() => {
    if (!open) {
      setError(null)
      setIsSubmitting(false)
    }
  }, [open])

  const formattedCreatedAt = useMemo(() => {
    if (!displayRow) {
      return ""
    }

    return new Date(displayRow.createdAt).toLocaleString("es-AR")
  }, [displayRow])

  const canMarkReady =
    canMarkRetencionReadyForRetiro &&
    displayRow?.status === "pendiente_administracion"

  async function handleMarkReadyForRetiro() {
    if (!retencionId) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    const result = await markRetencionReadyForRetiro(retencionId)

    if (!result.success) {
      setError(result.message ?? "No se pudo marcar listo para retiro.")
      setIsSubmitting(false)
      return
    }

    if (result.retencion && displayRow) {
      setDisplayRow({
        ...displayRow,
        status: result.retencion.status,
      })
    }

    setIsSubmitting(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[50rem]">
        <DialogHeader>
          <DialogTitle>Consultar gestión de baja</DialogTitle>
          <DialogDescription>
            {canMarkReady
              ? "Revisá la gestión y marcala lista para retiro cuando el trámite esté cumplimentado."
              : "Vista de supervisión."}
          </DialogDescription>
        </DialogHeader>

        {!displayRow || isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando gestión…</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <RetencionStatusBadge status={displayRow.status} />
              {displayRow.resultado ? (
                <RetencionResultadoBadge resultado={displayRow.resultado} />
              ) : null}
            </div>

            <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm">
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Cliente</dt>
                  <dd className="font-medium">{displayRow.customerName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Responsable</dt>
                  <dd className="font-medium">{displayRow.assignedEmployeeName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Iniciada</dt>
                  <dd className="font-medium">{formattedCreatedAt}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Motivo de baja</dt>
                  <dd className="font-medium">
                    {formatCustomerRetencionMotivoBajaLabel(displayRow.motivoBaja)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Detalle inicial</dt>
                  <dd>{displayRow.detail}</dd>
                </div>
                {displayRow.resolution ? (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Gestión de Atención al Cliente</dt>
                    <dd>{displayRow.resolution}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {canMarkReady ? (
            <Button
              type="button"
              disabled={isSubmitting || isLoading}
              onClick={() => void handleMarkReadyForRetiro()}
            >
              {isSubmitting ? "Guardando…" : "Marcar listo para retiro"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
