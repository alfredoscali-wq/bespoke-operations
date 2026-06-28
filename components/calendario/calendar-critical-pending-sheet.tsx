"use client"

import Link from "next/link"

import { useCalendarUI } from "@/components/calendario/calendar-ui-provider"
import { formatTaskDate, TASK_STATUS_LABELS } from "@/lib/tasks/constants"
import { computeOverdueDays, formatOverdueDaysLabel } from "@/lib/tasks/overdue-display"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

function DetailBlock({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
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

export function CalendarCriticalPendingSheet() {
  const {
    criticalPendingPanelOpen,
    closeCriticalPendingPanel,
    criticalPendingTasks,
  } = useCalendarUI()

  return (
    <Sheet
      open={criticalPendingPanelOpen}
      onOpenChange={(open) => {
        if (!open) closeCriticalPendingPanel()
      }}
    >
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Pendientes críticos</SheetTitle>
          <SheetDescription>
            Órdenes de trabajo en estado Vencida que requieren reprogramación
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-3 pb-6">
            {criticalPendingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay pendientes críticos en este momento.
              </p>
            ) : (
              criticalPendingTasks.map((task) => (
                <DetailBlock key={task.taskId} title={task.code}>
                  <Field label="Título" value={task.title} />
                  <Field
                    label="Obra"
                    value={`${task.projectCode} — ${task.projectName}`}
                  />
                  <Field label="Cuadrilla" value={task.crewName} />
                  <Field label="Supervisor" value={task.supervisorName} />
                  <Field
                    label="Vencimiento"
                    value={formatTaskDate(task.dueDate)}
                  />
                  <Field
                    label="Días vencida"
                    value={formatOverdueDaysLabel(
                      computeOverdueDays({
                        dueDate: task.dueDate,
                        status: task.status,
                      }) ?? 1
                    )}
                  />
                  <Field
                    label="Estado"
                    value={TASK_STATUS_LABELS[task.status]}
                  />
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/tareas/${task.taskId}`}>Ver orden de trabajo</Link>
                    </Button>
                    {task.projectId ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/obras/${task.projectId}`}>Ir a obra</Link>
                      </Button>
                    ) : null}
                  </div>
                </DetailBlock>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
