import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { resolvePlanningTaskShiftDisplayLabel } from "@/lib/planificacion/planning-utils"
import { isIncidentStatus } from "@/lib/tasks/incidents"
import { resolveTaskOperationalTitle } from "@/lib/tasks/work-order"
import type { Task } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"

type OperarioTaskCardProps = {
  task: Task
  variant?: "jornada" | "default"
}

function hasOperarioExecutionOrder(
  task: Pick<Task, "executionOrder">
): task is Task & { executionOrder: number } {
  return task.executionOrder != null && task.executionOrder > 0
}

function formatJornadaOrderPosition(order: number): string {
  return `${Math.floor(order)}º en la jornada`
}

function resolveJornadaOrderCircleClassName(task: Task): string {
  if (isIncidentStatus(task.status)) {
    return "border-red-500 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300"
  }

  if (task.status === "finalizada" || task.status === "cerrada") {
    return "border-border bg-muted text-muted-foreground"
  }

  return "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
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
  if (!hasOperarioExecutionOrder(task)) {
    return null
  }

  const order = Math.floor(task.executionOrder)
  const showIncidentNotice = isIncidentStatus(task.status)

  return (
    <aside
      className="flex w-[100px] shrink-0 flex-col items-center justify-center gap-2 border-l border-border/70 bg-muted/20 px-2 py-4 text-center"
      aria-label={`Orden ${order} en la jornada`}
    >
      <div
        className={cn(
          "flex size-14 items-center justify-center rounded-full border-[3px] text-2xl font-bold tabular-nums",
          resolveJornadaOrderCircleClassName(task)
        )}
      >
        {order}
      </div>
      <p className="text-[11px] font-medium leading-tight text-foreground">
        {formatJornadaOrderPosition(order)}
      </p>
      {showIncidentNotice ? (
        <div className="space-y-0.5 text-[10px] leading-tight text-red-700 dark:text-red-300">
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
  const workType = resolveTaskOperationalTitle(task)
  const address = task.serviceAddress?.trim() || "—"

  return (
    <>
      <OperarioShiftBadge task={task} />
      <dl className="mt-2 space-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">👤 Cliente</dt>
          <dd className="font-medium text-foreground">{customerName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">🔧 Tipo de trabajo</dt>
          <dd className="font-medium text-foreground">{workType}</dd>
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
      <article className="flex overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
        <div className="min-w-0 flex-1 p-4">
          <OperarioTaskCardContent task={task} />
        </div>
        <OperarioJornadaOrderRail task={task} />
      </article>
    )
  }

  return (
    <article className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
      <OperarioTaskCardContent task={task} />
    </article>
  )
}
