"use client"

import Link from "next/link"

import { useCalendarUI } from "@/components/calendario/calendar-ui-provider"
import { CrewAvailabilityBadge } from "@/components/cuadrillas/crew-badges"
import {
  CALENDAR_AVAILABILITY_LABELS,
} from "@/lib/calendar/calendar-labels"
import { formatAvailabilityDate } from "@/lib/availability/constants"
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/tasks/constants"
import { getTaskStatusSurfaceClass } from "@/lib/tasks/status-visual"
import type { TaskStatus } from "@/lib/types/tasks"
import type { CalendarKpiKey } from "@/lib/calendar/calendar-ui-utils"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"

const KPI_TITLES: Record<CalendarKpiKey, string> = {
  tasksInWeek: "Órdenes de trabajo de la semana",
  activeAbsences: "Ausencias activas",
  operationalCrews: "Cuadrillas operativas",
  reducedCrews: "Cuadrillas reducidas",
  notOperationalCrews: "Cuadrillas no operativas",
}

function DetailBlock({
  title,
  children,
  status,
}: {
  title: string
  children: React.ReactNode
  status?: TaskStatus
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 shadow-sm",
        status ? getTaskStatusSurfaceClass(status) : "bg-card"
      )}
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  )
}

function Field({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[120px_1fr] sm:items-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}

export function CalendarKpiSheet() {
  const {
    selectedKpi,
    closeKpiPanel,
    absenceDetails,
    operationalCrewDetails,
    reducedCrewDetails,
    notOperationalCrewDetails,
    weekTaskDetails,
  } = useCalendarUI()

  const title = selectedKpi ? KPI_TITLES[selectedKpi] : ""

  return (
    <Sheet
      open={selectedKpi !== null}
      onOpenChange={(open) => {
        if (!open) closeKpiPanel()
      }}
    >
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            Detalle operativo de la semana seleccionada
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-3 pb-6">
            {selectedKpi === "activeAbsences" &&
              (absenceDetails.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay ausencias activas en esta semana.
                </p>
              ) : (
                absenceDetails.map((item) => (
                  <DetailBlock
                    key={item.recordId}
                    title={`${item.employeeCode} — ${item.employeeName}`}
                  >
                    <Field
                      label="Tipo"
                      value={
                        CALENDAR_AVAILABILITY_LABELS[item.availabilityType]
                      }
                    />
                    <Field
                      label="Desde"
                      value={formatAvailabilityDate(item.startDate)}
                    />
                    <Field
                      label="Hasta"
                      value={formatAvailabilityDate(item.endDate)}
                    />
                    {item.crewNames.length > 0 ? (
                      <Field
                        label="Cuadrilla"
                        value={item.crewNames.join(", ")}
                      />
                    ) : null}
                  </DetailBlock>
                ))
              ))}

            {selectedKpi === "operationalCrews" &&
              (operationalCrewDetails.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay cuadrillas operativas para la fecha de referencia.
                </p>
              ) : (
                operationalCrewDetails.map((item) => (
                  <DetailBlock key={item.crewId} title={item.crewName}>
                    <Field label="Disponibles" value={item.availableMembers} />
                    <Field label="Ausentes" value={item.absentMembers} />
                    <Button asChild variant="outline" size="sm" className="mt-2">
                      <Link href={`/cuadrillas/${item.crewId}`}>
                        Ver cuadrilla
                      </Link>
                    </Button>
                  </DetailBlock>
                ))
              ))}

            {selectedKpi === "reducedCrews" &&
              (reducedCrewDetails.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay cuadrillas con capacidad reducida.
                </p>
              ) : (
                reducedCrewDetails.map((item) => (
                  <DetailBlock key={item.crewId} title={item.crewName}>
                    <Field label="Disponibles" value={item.availableMembers} />
                    <Field label="Ausentes" value={item.absentMembers} />
                    <Field
                      label="Estado"
                      value={
                        <CrewAvailabilityBadge status={item.status} />
                      }
                    />
                    <Button asChild variant="outline" size="sm" className="mt-2">
                      <Link href={`/cuadrillas/${item.crewId}`}>
                        Ver cuadrilla
                      </Link>
                    </Button>
                  </DetailBlock>
                ))
              ))}

            {selectedKpi === "notOperationalCrews" &&
              (notOperationalCrewDetails.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay cuadrillas no operativas.
                </p>
              ) : (
                notOperationalCrewDetails.map((item) => (
                  <DetailBlock key={item.crewId} title={item.crewName}>
                    <Field label="Integrantes" value={item.totalMembers} />
                    <Field label="Motivo" value={item.reason ?? "—"} />
                    <Button asChild variant="outline" size="sm" className="mt-2">
                      <Link href={`/cuadrillas/${item.crewId}`}>
                        Ver cuadrilla
                      </Link>
                    </Button>
                  </DetailBlock>
                ))
              ))}

            {selectedKpi === "tasksInWeek" &&
              (weekTaskDetails.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay órdenes de trabajo en esta semana.
                </p>
              ) : (
                weekTaskDetails.map((item) => (
                  <DetailBlock key={item.taskId} title={item.code} status={item.status}>
                    <Field label="Título" value={item.title} />
                    <Field
                      label="Estado"
                      value={TASK_STATUS_LABELS[item.status]}
                    />
                    <Field
                      label="Prioridad"
                      value={TASK_PRIORITY_LABELS[item.priority]}
                    />
                    <Field label="Cuadrilla" value={item.crewName} />
                    <Button asChild variant="outline" size="sm" className="mt-2">
                      <Link href={`/tareas/${item.taskId}`}>Ver orden de trabajo</Link>
                    </Button>
                  </DetailBlock>
                ))
              ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
