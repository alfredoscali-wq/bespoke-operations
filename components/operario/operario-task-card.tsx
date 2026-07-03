import Link from "next/link"

import { DispatchOrderBadge } from "@/components/tareas/dispatch-order-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { resolvePlanningTaskShiftDisplayLabel } from "@/lib/planificacion/planning-utils"
import {
  formatDispatchOrderNumericLabel,
  resolveTaskRouteOrder,
} from "@/lib/tasks/dispatch-order"
import { getTaskStatusCircleClass, getTaskStatusSurfaceClass } from "@/lib/tasks/status-visual"
import { resolveTaskOperationalTitle } from "@/lib/tasks/work-order"
import type { Task } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"

type OperarioTaskCardProps = {
  task: Task
  variant?: "jornada" | "default"
}

function hasOperarioRouteOrder(
  task: Pick<Task, "dispatchOrder" | "executionOrder">
): task is Task & { dispatchOrder: number } | Task & { executionOrder: number } {
  return resolveTaskRouteOrder(task) != null
}

function formatJornadaOrderPosition(order: number): string {
  return `${Math.floor(order)}º en la jornada`
}

function resolveJornadaOrderCircleClassName(task: Task): string {
  return getTaskStatusCircleClass(task.status)
}

function OperarioShiftBadge({ task }: { task: Task }) {
  const shiftLabel = resolvePlanningTaskShiftDisplayLabel(task)

  if (shiftLabel === "—") {
    return null
  }

  return (
    <Badge
      variant="outline"
      className="rounded-md px-2 py-0.5 text-xs font-semibold"
    >
      {shiftLabel}
    </Badge>
  )
}

function OperarioJornadaOrderRail({ task }: { task: Task }) {
  const order = resolveTaskRouteOrder(task)
  if (order == null) {
    return null
  }

  const numericLabel = formatDispatchOrderNumericLabel(order)
  const showIncidentNotice = task.status === "incidencia"

  return (
    <aside
      className="flex w-[100px] shrink-0 flex-col items-center justify-center gap-2 border-l border-border/70 bg-muted/20 px-2 py-4 text-center"
      aria-label={`Ruta ${order} en la jornada`}
    >
      <div
        className={cn(
          "flex size-14 items-center justify-center rounded-full border-[3px] text-2xl font-bold tabular-nums",
          resolveJornadaOrderCircleClassName(task)
        )}
      >
        {numericLabel}
      </div>
      <p className="text-[11px] font-medium leading-tight text-foreground">
        {formatJornadaOrderPosition(order)}
      </p>
      {showIncidentNotice ? (
        <div className="space-y-0.5 text-[10px] leading-tight text-zinc-700 dark:text-zinc-300">
          <p className="font-semibold">⚠ Incidencia</p>
          <p>Esperando respuesta del supervisor</p>
        </div>
      ) : null}
    </aside>
  )
}

function OperarioTaskCardContent({ task }: { task: Task }) {
  const customerName =
    task.customerName?.trim() || task.projectName?.trim() || "—"
  const workType = resolveTaskOperationalTitle(task).toUpperCase()
  const address = task.serviceAddress?.trim() || "—"

  return (
    <>
      <div className="flex items-start gap-3">
        <DispatchOrderBadge task={task} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-primary">
            {workType}
          </p>
          <OperarioShiftBadge task={task} />
        </div>
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">👤 Cliente</dt>
          <dd className="font-medium text-foreground">{customerName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">📍 Dirección</dt>
          <dd className="font-medium text-foreground">{address}</dd>
        </div>
      </dl>
      <Button
        asChild
        className="mt-4 h-11 w-full rounded-xl text-sm font-semibold"
      >
        <Link href={`/operario/tarea/${task.id}`}>Ver orden de trabajo</Link>
      </Button>
    </>
  )
}

export function OperarioTaskCard({
  task,
  variant = "default",
}: OperarioTaskCardProps) {
  if (variant === "jornada") {
    return (
      <article
        className={cn(
          "flex overflow-hidden rounded-2xl border shadow-sm",
          getTaskStatusSurfaceClass(task.status)
        )}
      >
        <div className="min-w-0 flex-1 p-4">
          <OperarioTaskCardContent task={task} />
        </div>
        {hasOperarioRouteOrder(task) ? (
          <OperarioJornadaOrderRail task={task} />
        ) : null}
      </article>
    )
  }

  return (
    <article
      className={cn(
        "rounded-2xl border p-4 shadow-sm",
        getTaskStatusSurfaceClass(task.status)
      )}
    >
      <OperarioTaskCardContent task={task} />
    </article>
  )
}
