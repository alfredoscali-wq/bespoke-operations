"use client"

import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

import type { Task } from "@/lib/types/tasks"
import type { PlanningTaskCoordinates } from "@/lib/planificacion/planning-utils"
import {
  resolvePlanningTaskClientLabel,
  resolvePlanningTaskCrewLabel,
  resolvePlanningTaskServiceLabel,
  resolveTaskPlanningCoordinates,
} from "@/lib/planificacion/planning-utils"
import { WORK_ORDER_SHIFT_OPTIONS } from "@/lib/tasks/work-order"
import { cn } from "@/lib/utils"

const PlanningMapCanvas = dynamic(
  () =>
    import("@/components/planificacion/planning-map-canvas").then(
      (module) => module.PlanningMapCanvas
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl border bg-muted/20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
)

type PlanningMapProps = {
  tasks: Task[]
  selectedTaskId: string | null
  onSelectTask: (taskId: string) => void
  shiftLabel: string
  className?: string
}

export type PlanningMapMarker = {
  task: Task
  coordinates: PlanningTaskCoordinates
}

export function buildPlanningMapMarkers(tasks: Task[]): PlanningMapMarker[] {
  return tasks.flatMap((task) => {
    const coordinates = resolveTaskPlanningCoordinates(task)
    if (!coordinates) {
      return []
    }

    return [{ task, coordinates }]
  })
}

export function PlanningMap({
  tasks,
  selectedTaskId,
  onSelectTask,
  shiftLabel,
  className,
}: PlanningMapProps) {
  const markers = buildPlanningMapMarkers(tasks)
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null

  return (
    <section
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Mapa operativo</h2>
          <p className="text-xs text-muted-foreground">
            {markers.length} OT con GPS · Turno {shiftLabel}
          </p>
        </div>
      </div>

      <div className="relative min-h-[420px] flex-1">
        <PlanningMapCanvas
          markers={markers}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
        />

        {selectedTask ? (
          <div className="pointer-events-none absolute bottom-4 left-4 z-[500] max-w-xs rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur">
            <p className="text-sm font-semibold text-foreground">
              {resolvePlanningTaskClientLabel(selectedTask)}
            </p>
            <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between gap-3">
                <dt>Tipo</dt>
                <dd className="text-right font-medium text-foreground">
                  {resolvePlanningTaskServiceLabel(selectedTask)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Duración</dt>
                <dd className="text-right font-medium text-foreground">
                  {selectedTask.estimatedDuration || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Turno</dt>
                <dd className="text-right font-medium text-foreground">
                  {shiftLabel}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Cuadrilla sugerida</dt>
                <dd className="text-right font-medium text-foreground">
                  {resolvePlanningTaskCrewLabel(selectedTask)}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function resolvePlanningShiftLabel(shift: string): string {
  return (
    WORK_ORDER_SHIFT_OPTIONS.find((option) => option.value === shift)?.label ??
    shift
  )
}
