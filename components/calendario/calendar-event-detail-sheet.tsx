"use client"

import Link from "next/link"

import { useCalendar } from "@/components/calendario/calendar-provider"
import { useCalendarUI } from "@/components/calendario/calendar-ui-provider"
import { AvailabilityBadge } from "@/components/disponibilidad/availability-badge"
import { CrewAvailabilityBadge } from "@/components/cuadrillas/crew-badges"
import {
  CALENDAR_AVAILABILITY_LABELS,
  CALENDAR_CREW_STATUS_LABELS,
  CALENDAR_TASK_ALERT_LABELS,
} from "@/lib/calendar/calendar-labels"
import { formatAvailabilityDate } from "@/lib/availability/constants"
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  formatTaskDate,
} from "@/lib/tasks/constants"
import type {
  CalendarAvailabilityPayload,
  CalendarCrewStatusPayload,
  CalendarTaskAlert,
  CalendarTaskPayload,
} from "@/lib/types/calendar"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

function DetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}

function TaskOperationalIncidents({
  alerts,
}: {
  alerts: CalendarTaskAlert[]
}) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border bg-muted/20 p-4">
        <p className="text-sm font-semibold text-foreground">
          Incidencias operativas
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          No se detectaron incidencias para este día.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <p className="text-sm font-semibold text-foreground">
        Incidencias operativas
      </p>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.kind}
            className="rounded-lg border bg-background px-3 py-2.5"
          >
            <p className="text-sm font-medium text-foreground">
              ⚠ {CALENDAR_TASK_ALERT_LABELS[alert.kind]}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{alert.message}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function TaskEventDetail({ payload }: { payload: CalendarTaskPayload }) {
  return (
    <div className="grid gap-4">
      <DetailRow label="Código" value={payload.code} />
      <DetailRow
        label="Proyecto"
        value={`${payload.projectCode} — ${payload.projectName}`}
      />
      <DetailRow
        label="Cliente"
        value={
          payload.customerCompany || payload.customerName || "—"
        }
      />
      <DetailRow label="Dirección" value={payload.serviceAddress || "—"} />
      <DetailRow label="Estado" value={TASK_STATUS_LABELS[payload.status]} />
      <DetailRow
        label="Prioridad"
        value={TASK_PRIORITY_LABELS[payload.priority]}
      />
      <DetailRow
        label="Fecha inicio"
        value={formatTaskDate(payload.startDate)}
      />
      <DetailRow label="Fecha fin" value={formatTaskDate(payload.dueDate)} />
      <TaskOperationalIncidents alerts={payload.alerts} />
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link href={`/tareas/${payload.taskId}`}>Ver tarea</Link>
      </Button>
    </div>
  )
}

function AvailabilityEventDetail({
  payload,
}: {
  payload: CalendarAvailabilityPayload
}) {
  const { getAbsenceImpact } = useCalendarUI()
  const impacts = getAbsenceImpact(payload.employeeId)

  return (
    <div className="grid gap-4">
      <DetailRow
        label="Empleado"
        value={`${payload.employeeCode} — ${payload.employeeName}`}
      />
      <DetailRow
        label="Tipo"
        value={<AvailabilityBadge type={payload.availabilityType} />}
      />
      <DetailRow
        label="Desde"
        value={formatAvailabilityDate(payload.startDate)}
      />
      <DetailRow
        label="Hasta"
        value={formatAvailabilityDate(payload.endDate)}
      />
      <DetailRow label="Motivo" value={payload.reason || "—"} />

      {impacts.length > 0 ? (
        <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
          <p className="text-sm font-semibold text-foreground">
            Impacto operativo
          </p>
          <div className="space-y-3">
            {impacts.map((impact) => (
              <div
                key={impact.crewId}
                className="rounded-lg border bg-background px-3 py-2.5"
              >
                <p className="text-sm font-medium">{impact.crewName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {impact.statusLabel}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Base preparada para futuras sugerencias de reemplazo.
          </p>
        </div>
      ) : null}
    </div>
  )
}

function CrewStatusEventDetail({
  payload,
}: {
  payload: CalendarCrewStatusPayload
}) {
  return (
    <div className="grid gap-4">
      <DetailRow label="Nombre" value={payload.crewName} />
      <DetailRow label="Disponibles" value={payload.availableMembers} />
      <DetailRow label="Ausentes" value={payload.absentMembers} />
      <DetailRow
        label="Estado operativo"
        value={<CrewAvailabilityBadge status={payload.status} />}
      />
      <DetailRow
        label="Fecha"
        value={formatAvailabilityDate(payload.referenceDate)}
      />
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link href={`/cuadrillas/${payload.crewId}`}>Ver cuadrilla</Link>
      </Button>
    </div>
  )
}

export function CalendarEventDetailSheet() {
  const { selectedEvent, selectEvent } = useCalendar()

  const title = selectedEvent
    ? selectedEvent.type === "TASK"
      ? selectedEvent.payload.title
      : selectedEvent.type === "AVAILABILITY"
        ? selectedEvent.payload.employeeName
        : selectedEvent.payload.crewName
    : ""

  const description = selectedEvent
    ? selectedEvent.type === "TASK"
      ? "Detalle de tarea"
      : selectedEvent.type === "AVAILABILITY"
        ? CALENDAR_AVAILABILITY_LABELS[selectedEvent.payload.availabilityType]
        : CALENDAR_CREW_STATUS_LABELS[selectedEvent.payload.status]
    : ""

  return (
    <Sheet
      open={selectedEvent !== null}
      onOpenChange={(open) => {
        if (!open) selectEvent(null)
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4">
          {selectedEvent?.type === "TASK" ? (
            <TaskEventDetail payload={selectedEvent.payload} />
          ) : null}
          {selectedEvent?.type === "AVAILABILITY" ? (
            <AvailabilityEventDetail payload={selectedEvent.payload} />
          ) : null}
          {selectedEvent?.type === "CREW_STATUS" ? (
            <CrewStatusEventDetail payload={selectedEvent.payload} />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
