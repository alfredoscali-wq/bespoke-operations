"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import type { PlanningCrewSummary } from "@/lib/planificacion/planning-utils"
import {
  formatPlanningEstimatedHours,
  resolveCrewLoadLabel,
} from "@/lib/planificacion/planning-utils"
import { cn } from "@/lib/utils"

type PlanningCrewPanelProps = {
  summaries: PlanningCrewSummary[]
  className?: string
}

export function PlanningCrewPanel({
  summaries,
  className,
}: PlanningCrewPanelProps) {
  return (
    <section
      className={cn(
        "flex min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm lg:w-72",
        className
      )}
    >
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Cuadrillas</h2>
        <p className="text-xs text-muted-foreground">
          {summaries.length} cuadrilla{summaries.length === 1 ? "" : "s"} activa
          {summaries.length === 1 ? "" : "s"} · carga diaria
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
          {summaries.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
              No hay cuadrillas activas disponibles.
            </p>
          ) : (
            summaries.map(({ crew, taskCount, estimatedMinutes, loadLevel }) => (
              <article
                key={crew.id}
                className="rounded-lg border bg-muted/10 px-3 py-3"
              >
                <p className="text-sm font-semibold text-foreground">
                  {crew.name}
                </p>
                <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between gap-2">
                    <dt>OT</dt>
                    <dd className="font-medium text-foreground">{taskCount}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Tiempo estimado</dt>
                    <dd className="font-medium text-foreground">
                      {formatPlanningEstimatedHours(estimatedMinutes)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Carga</dt>
                    <dd className="text-right font-medium text-foreground">
                      {resolveCrewLoadLabel(loadLevel)}
                    </dd>
                  </div>
                </dl>
              </article>
            ))
          )}
        </div>
      </ScrollArea>
    </section>
  )
}
