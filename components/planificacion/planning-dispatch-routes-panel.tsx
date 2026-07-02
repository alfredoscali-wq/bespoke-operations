"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { formatDispatchOrderBadge, resolveTaskRouteOrder } from "@/lib/tasks/dispatch-order"
import type { PlanningCrewRoute } from "@/lib/planificacion/planning-dispatch"
import {
  resolvePlanningTaskClientLabel,
  resolvePlanningTaskLocality,
  resolvePlanningTaskServiceLabel,
  resolvePlanningTaskShiftDisplayLabel,
} from "@/lib/planificacion/planning-utils"
import { cn } from "@/lib/utils"

type PlanningDispatchRoutesPanelProps = {
  routes: PlanningCrewRoute[]
  selectedTaskId: string | null
  onSelectTask: (taskId: string) => void
  className?: string
}

export function PlanningDispatchRoutesPanel({
  routes,
  selectedTaskId,
  onSelectTask,
  className,
}: PlanningDispatchRoutesPanelProps) {
  const routesWithTasks = routes.filter((route) => route.tasks.length > 0)

  return (
    <section
      className={cn(
        "flex min-h-0 h-full w-full shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm",
        className
      )}
    >
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          Despacho por cuadrilla
        </h2>
        <p className="text-xs text-muted-foreground">
          Orden de visitas por cuadrilla para la jornada confirmada
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-3">
          {routesWithTasks.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
              No hay cuadrillas con OT asignadas para esta jornada.
            </p>
          ) : (
            routesWithTasks.map((route) => (
              <article
                key={route.crewId}
                className="overflow-hidden rounded-lg border bg-muted/10"
              >
                <div className="border-b bg-muted/20 px-3 py-2.5">
                  <p className="text-sm font-semibold text-foreground">
                    {route.crewName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {route.tasks.length} parada
                    {route.tasks.length === 1 ? "" : "s"}
                  </p>
                </div>

                <ol className="divide-y">
                  {route.tasks.map((task) => {
                    const orderLabel = formatDispatchOrderBadge(
                      resolveTaskRouteOrder(task)
                    )
                    const selected = task.id === selectedTaskId

                    return (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => onSelectTask(task.id)}
                          className={cn(
                            "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/30",
                            selected && "bg-primary/5"
                          )}
                        >
                          <span
                            className="mt-0.5 shrink-0 text-base leading-none text-primary"
                            aria-label={
                              orderLabel
                                ? `Ruta ${resolveTaskRouteOrder(task)}`
                                : "Sin ruta"
                            }
                          >
                            {orderLabel ?? "·"}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-foreground">
                              {resolvePlanningTaskClientLabel(task)}
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {resolvePlanningTaskServiceLabel(task)} ·{" "}
                              {resolvePlanningTaskLocality(task)}
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {resolvePlanningTaskShiftDisplayLabel(task)}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </article>
            ))
          )}
        </div>
      </ScrollArea>
    </section>
  )
}
