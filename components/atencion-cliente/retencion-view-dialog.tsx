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
  const { fetchRetencionById } = useAtencionCliente()
  const [displayRow, setDisplayRow] = useState<CustomerRetencionSupervisionRow | null>(
    listRow
  )
  const [isLoading, setIsLoading] = useState(false)

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

  const formattedCreatedAt = useMemo(() => {
    if (!displayRow) {
      return ""
    }

    return new Date(displayRow.createdAt).toLocaleString("es-AR")
  }, [displayRow])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[50rem]">
        <DialogHeader>
          <DialogTitle>Consultar retención</DialogTitle>
          <DialogDescription>
            Vista de supervisión. Solo lectura.
          </DialogDescription>
        </DialogHeader>

        {!displayRow || isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando retención…</p>
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
                  <dt className="text-muted-foreground">Asignada por</dt>
                  <dd className="font-medium">{displayRow.assignedByEmployeeName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Fecha de asignación</dt>
                  <dd className="font-medium">{formattedCreatedAt}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Motivo de baja</dt>
                  <dd className="font-medium">
                    {formatCustomerRetencionMotivoBajaLabel(displayRow.motivoBaja)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Detalle original</dt>
                  <dd>{displayRow.detail}</dd>
                </div>
                {displayRow.resolution ? (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Resolución final</dt>
                    <dd>{displayRow.resolution}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
