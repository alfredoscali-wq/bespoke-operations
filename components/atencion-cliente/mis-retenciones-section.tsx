"use client"

import { useEffect, useState } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import { RetencionWorkDialog } from "@/components/atencion-cliente/retencion-work-dialog"
import { formatCustomerRetencionMotivoBajaLabel } from "@/lib/customer-retenciones/format"
import type { CustomerRetencionActiveRow } from "@/lib/types/customer-retenciones"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type MisRetencionesSectionProps = {
  highlighted?: boolean
}

function RetencionItemButton({
  item,
  onOpen,
}: {
  item: CustomerRetencionActiveRow
  onOpen: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className="flex w-full flex-col gap-1 rounded-lg border px-3 py-3 text-left transition-colors hover:bg-muted/50"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{item.customerName}</span>
        <span className="text-xs text-muted-foreground">
          {new Date(item.createdAt).toLocaleDateString("es-AR")}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {formatCustomerRetencionMotivoBajaLabel(item.motivoBaja)}
      </p>
      <p className="text-sm text-muted-foreground">
        Asignada por {item.assignedByEmployeeName}
      </p>
      <p className="line-clamp-2 text-sm">{item.detail}</p>
    </button>
  )
}

export function MisRetencionesSection({
  highlighted = false,
}: MisRetencionesSectionProps) {
  const { pendingRetenciones, isDashboardLoading } = useAtencionCliente()
  const [selectedRetencionId, setSelectedRetencionId] = useState<string | null>(
    null
  )

  return (
    <>
      <Card className={cn(highlighted && "ring-2 ring-primary/20")}>
        <CardHeader>
          <CardTitle>Mis Retenciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isDashboardLoading ? (
            <p className="text-sm text-muted-foreground">Cargando retenciones…</p>
          ) : pendingRetenciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tenés retenciones activas asignadas.
            </p>
          ) : (
            pendingRetenciones.map((item) => (
              <RetencionItemButton
                key={item.id}
                item={item}
                onOpen={setSelectedRetencionId}
              />
            ))
          )}
        </CardContent>
      </Card>

      <RetencionWorkDialog
        retencionId={selectedRetencionId}
        open={Boolean(selectedRetencionId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRetencionId(null)
          }
        }}
      />
    </>
  )
}
