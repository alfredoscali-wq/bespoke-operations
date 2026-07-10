"use client"

import { useMemo, useState } from "react"

import { RetencionViewDialog } from "@/components/atencion-cliente/retencion-view-dialog"
import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import {
  formatCustomerRetencionMotivoBajaLabel,
  formatCustomerRetencionResultadoLabel,
  formatCustomerRetencionStatusLabel,
  getCustomerRetencionResultadoTone,
  getCustomerRetencionStatusTone,
} from "@/lib/customer-retenciones/format"
import {
  applyAssignedRetencionSupervisionView,
  type AssignedRetencionFilter,
} from "@/lib/customer-retenciones/supervision"
import type { CustomerRetencionSupervisionRow } from "@/lib/types/customer-retenciones"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { STATUS_BADGE_BASE, STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

const FILTER_OPTIONS: Array<{ value: AssignedRetencionFilter; label: string }> = [
  { value: "todas", label: "Todas" },
  { value: "pendientes_administracion", label: "Pendientes de Administración" },
  { value: "pendientes_retiro", label: "Pendientes de retiro" },
  { value: "finalizadas", label: "Finalizadas" },
]

function RetencionFilterToggle({
  filter,
  onFilterChange,
}: {
  filter: AssignedRetencionFilter
  onFilterChange: (filter: AssignedRetencionFilter) => void
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border p-1">
      {FILTER_OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={filter === option.value ? "default" : "ghost"}
          onClick={() => onFilterChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

function RetencionSupervisionItemButton({
  item,
  onOpen,
}: {
  item: CustomerRetencionSupervisionRow
  onOpen: (item: CustomerRetencionSupervisionRow) => void
}) {
  const statusTone = getCustomerRetencionStatusTone(item.status)

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="flex w-full flex-col gap-2 rounded-lg border px-3 py-3 text-left transition-colors hover:bg-muted/50"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{item.customerName}</span>
        <span className="text-xs text-muted-foreground">
          {new Date(item.createdAt).toLocaleDateString("es-AR")}
        </span>
        <Badge
          variant="outline"
          className={cn(STATUS_BADGE_BASE, STATUS_TONE_STYLES[statusTone])}
        >
          {formatCustomerRetencionStatusLabel(item.status)}
        </Badge>
        {item.resultado ? (
          <Badge
            variant="outline"
            className={cn(
              STATUS_BADGE_BASE,
              STATUS_TONE_STYLES[getCustomerRetencionResultadoTone(item.resultado)]
            )}
          >
            {formatCustomerRetencionResultadoLabel(item.resultado)}
          </Badge>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Responsable: {item.assignedEmployeeName}
      </p>
      <p className="text-sm text-muted-foreground">
        {formatCustomerRetencionMotivoBajaLabel(item.motivoBaja)}
      </p>
    </button>
  )
}

export function RetencionesAsignadasSection() {
  const { assignedRetenciones, isDashboardLoading } = useAtencionCliente()
  const [filter, setFilter] = useState<AssignedRetencionFilter>("todas")
  const [selectedRetencion, setSelectedRetencion] =
    useState<CustomerRetencionSupervisionRow | null>(null)

  const visibleRetenciones = useMemo(
    () => applyAssignedRetencionSupervisionView(assignedRetenciones, filter),
    [assignedRetenciones, filter]
  )

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Gestiones de baja</CardTitle>
          <RetencionFilterToggle filter={filter} onFilterChange={setFilter} />
        </CardHeader>
        <CardContent className="space-y-3">
          {isDashboardLoading ? (
            <p className="text-sm text-muted-foreground">Cargando gestiones…</p>
          ) : visibleRetenciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay gestiones para este filtro.
            </p>
          ) : (
            visibleRetenciones.map((item) => (
              <RetencionSupervisionItemButton
                key={item.id}
                item={item}
                onOpen={setSelectedRetencion}
              />
            ))
          )}
        </CardContent>
      </Card>

      <RetencionViewDialog
        retencionId={selectedRetencion?.id ?? null}
        listRow={selectedRetencion}
        open={Boolean(selectedRetencion)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRetencion(null)
          }
        }}
      />
    </>
  )
}
