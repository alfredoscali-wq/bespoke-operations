"use client"

import { useMemo, useState } from "react"

import { SeguimientoWorkDialog } from "@/components/atencion-cliente/seguimiento-work-dialog"
import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import {
  groupAgendaWeekItems,
  sortAgendaTodayItems,
} from "@/lib/customer-seguimientos/agenda"
import { formatScheduledTimeLabel } from "@/lib/customer-seguimientos/format"
import type { CustomerSeguimientoAgendaRow } from "@/lib/types/customer-seguimientos"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type AgendaView = "hoy" | "semana"

type MiAgendaSectionProps = {
  view: AgendaView
  highlighted?: boolean
}

function AgendaItemButton({
  item,
  onOpen,
}: {
  item: CustomerSeguimientoAgendaRow
  onOpen: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className={cn(
        "flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-3 text-left transition-colors hover:bg-muted/50",
        item.isOverdue && "border-red-200 bg-red-500/[0.04]"
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {formatScheduledTimeLabel(item.scheduledTime)}
          </span>
          <Badge variant="outline" className="border-violet-200 text-violet-700">
            Seguimiento
          </Badge>
          {item.isOverdue ? (
            <Badge variant="outline" className="border-red-200 text-red-700">
              Vencido
            </Badge>
          ) : null}
        </div>
        <p className="text-sm font-medium">{item.customerName}</p>
        <p className="text-sm text-muted-foreground">{item.observation}</p>
      </div>
    </button>
  )
}

export function MiAgendaSection({
  view,
  highlighted = false,
}: MiAgendaSectionProps) {
  const { getAgendaItems, isDashboardLoading } = useAtencionCliente()
  const [selectedSeguimientoId, setSelectedSeguimientoId] = useState<string | null>(
    null
  )

  const items = getAgendaItems(view)
  const todayGroups = useMemo(
    () => sortAgendaTodayItems(items),
    [items]
  )
  const weekGroups = useMemo(
    () => groupAgendaWeekItems(items, new Date()),
    [items]
  )

  return (
    <>
      <Card className={cn(highlighted && "ring-2 ring-primary/20")}>
        <CardHeader>
          <CardTitle>Mi Agenda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isDashboardLoading ? (
            <p className="text-sm text-muted-foreground">Cargando agenda…</p>
          ) : view === "hoy" ? (
            <>
              {todayGroups.overdue.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-red-700">
                    Vencidos
                  </p>
                  {todayGroups.overdue.map((item) => (
                    <AgendaItemButton
                      key={item.id}
                      item={item}
                      onOpen={setSelectedSeguimientoId}
                    />
                  ))}
                </div>
              ) : null}

              {todayGroups.scheduled.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Con horario
                  </p>
                  {todayGroups.scheduled.map((item) => (
                    <AgendaItemButton
                      key={item.id}
                      item={item}
                      onOpen={setSelectedSeguimientoId}
                    />
                  ))}
                </div>
              ) : null}

              {todayGroups.unscheduled.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Sin horario
                  </p>
                  {todayGroups.unscheduled.map((item) => (
                    <AgendaItemButton
                      key={item.id}
                      item={item}
                      onOpen={setSelectedSeguimientoId}
                    />
                  ))}
                </div>
              ) : null}

              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay seguimientos pendientes para hoy.
                </p>
              ) : null}
            </>
          ) : (
            <>
              {weekGroups.overdue.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-red-700">
                    Vencidos
                  </p>
                  {weekGroups.overdue.map((item) => (
                    <AgendaItemButton
                      key={item.id}
                      item={item}
                      onOpen={setSelectedSeguimientoId}
                    />
                  ))}
                </div>
              ) : null}

              {weekGroups.days.map((day) => (
                <div key={day.dateKey} className="space-y-2">
                  <p className="text-sm font-medium capitalize">{day.label}</p>
                  {day.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sin gestiones programadas
                    </p>
                  ) : (
                    day.items.map((item) => (
                      <AgendaItemButton
                        key={item.id}
                        item={item}
                        onOpen={setSelectedSeguimientoId}
                      />
                    ))
                  )}
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <SeguimientoWorkDialog
        seguimientoId={selectedSeguimientoId}
        open={Boolean(selectedSeguimientoId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSeguimientoId(null)
          }
        }}
      />
    </>
  )
}

export function MiAgendaViewToggle({
  view,
  onViewChange,
}: {
  view: AgendaView
  onViewChange: (view: AgendaView) => void
}) {
  return (
    <div className="inline-flex rounded-lg border p-1">
      <Button
        type="button"
        size="sm"
        variant={view === "hoy" ? "default" : "ghost"}
        onClick={() => onViewChange("hoy")}
      >
        Hoy
      </Button>
      <Button
        type="button"
        size="sm"
        variant={view === "semana" ? "default" : "ghost"}
        onClick={() => onViewChange("semana")}
      >
        Semana
      </Button>
    </div>
  )
}
