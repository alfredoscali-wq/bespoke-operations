"use client"

import { useMemo } from "react"
import dynamic from "next/dynamic"
import { Loader2, RefreshCw } from "lucide-react"

import { PlanningTaskOrderInput } from "@/components/planificacion/planning-task-order-input"
import { PlanningTaskObservationsBlock } from "@/components/planificacion/planning-task-observations-block"
import { Button } from "@/components/ui/button"
import type { Task } from "@/lib/types/tasks"
import type { Crew } from "@/lib/types/crews"
import type { PlanningTaskCoordinates } from "@/lib/planificacion/planning-utils"
import {
  buildPlanningCrewColorIndex,
  buildPlanningCrewLegendItems,
  PLANNING_PIN_COLOR_NO_CREW,
  PLANNING_PIN_COLOR_SELECTED,
  PLANNING_PIN_COLOR_VENCIDA,
} from "@/lib/planificacion/planning-map-markers"
import {
  countOperationalOrderReorderablesForTask,
  isOperationalOrderReorderable,
} from "@/lib/planificacion/planning-execution-order"
import { resolveTaskRouteOrder } from "@/lib/tasks/dispatch-order"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import {
  resolvePlanningTaskClientLabel,
  resolvePlanningTaskCrewLabel,
  resolvePlanningTaskServiceLabel,
  resolvePlanningTaskShiftDisplayLabel,
  resolveTaskPlanningCoordinates,
} from "@/lib/planificacion/planning-utils"
import { cn } from "@/lib/utils"

const PlanningMapCanvas = dynamic(
  () =>
    import("@/components/planificacion/planning-map-canvas").then(
      (module) => module.PlanningMapCanvas
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[15rem] items-center justify-center rounded-xl border bg-muted/20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
)

type PlanningMapProps = {
  tasks: Task[]
  selectedTaskId: string | null
  highlightedTaskId: string | null
  crewIdsInOrder: string[]
  crewNamesById: Record<string, string>
  onSelectTask: (taskId: string) => void
  planningDate: string
  isEditMode?: boolean
  className?: string
  onRefreshMap?: () => void | Promise<void>
  isRefreshingMap?: boolean
  mapRefreshToken?: number
  mapRefreshError?: string | null
  activeCrewFilterId?: string | null
  crews?: Pick<Crew, "id" | "name">[]
  allScopeTasks?: Task[]
  reorderingTaskId?: string | null
  onMoveTaskToPosition?: (taskId: string, position: number) => void
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

function PlanningMapLegend({
  crewItems,
}: {
  crewItems: Array<{ label: string; color: string }>
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-[11px] text-muted-foreground">
      {crewItems.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          {item.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block size-2.5 rounded-full"
          style={{ backgroundColor: PLANNING_PIN_COLOR_SELECTED }}
          aria-hidden
        />
        OT seleccionada
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block size-2.5 rounded-full"
          style={{ backgroundColor: PLANNING_PIN_COLOR_VENCIDA }}
          aria-hidden
        />
        OT vencida
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block size-2.5 rounded-full"
          style={{ backgroundColor: PLANNING_PIN_COLOR_NO_CREW }}
          aria-hidden
        />
        Sin cuadrilla
      </span>
    </div>
  )
}

function PlanningMapSelectedTaskOverlay({
  task,
  isEditMode,
  allScopeTasks,
  crews,
  reorderingTaskId,
  onMoveTaskToPosition,
}: {
  task: Task
  isEditMode: boolean
  allScopeTasks: Task[]
  crews: Pick<Crew, "id" | "name">[]
  reorderingTaskId: string | null
  onMoveTaskToPosition?: (taskId: string, position: number) => void
}) {
  const currentOrder = resolveTaskRouteOrder(task)
  const canEditOrder =
    isEditMode &&
    isOperationalOrderReorderable(task) &&
    resolveTaskCrewId(task, crews) != null &&
    onMoveTaskToPosition != null
  const maxOrder = useMemo(
    () => countOperationalOrderReorderablesForTask(allScopeTasks, task.id, crews),
    [allScopeTasks, task.id, crews]
  )
  const isReordering = reorderingTaskId === task.id

  return (
    <div
      className={cn(
        "absolute bottom-4 left-4 z-[500] max-w-sm rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur",
        canEditOrder ? "pointer-events-auto" : "pointer-events-none"
      )}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <p className="text-sm font-semibold text-foreground">
        {task.code} · {resolvePlanningTaskClientLabel(task)}
      </p>
      <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between gap-3">
          <dt>Tipo</dt>
          <dd className="text-right font-medium text-foreground">
            {resolvePlanningTaskServiceLabel(task)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Cuadrilla</dt>
          <dd className="text-right font-medium text-foreground">
            {resolvePlanningTaskCrewLabel(task)}
          </dd>
        </div>
        {!isEditMode ? (
          <>
            <div className="flex justify-between gap-3">
              <dt>Duración</dt>
              <dd className="text-right font-medium text-foreground">
                {task.estimatedDuration || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Turno</dt>
              <dd className="text-right font-medium text-foreground">
                {resolvePlanningTaskShiftDisplayLabel(task)}
              </dd>
            </div>
          </>
        ) : null}
        <div className="flex items-center justify-between gap-3 pt-1">
          <dt>Orden</dt>
          <dd className="text-right font-medium text-foreground">
            {canEditOrder ? (
              <PlanningTaskOrderInput
                taskId={task.id}
                currentOrder={currentOrder}
                maxOrder={maxOrder}
                disabled={isReordering}
                onMoveToPosition={onMoveTaskToPosition!}
              />
            ) : (
              (currentOrder ?? "—")
            )}
          </dd>
        </div>
      </dl>

      <PlanningTaskObservationsBlock
        task={task}
        title="Observaciones para la cuadrilla"
      />
    </div>
  )
}

export function PlanningMap({
  tasks,
  selectedTaskId,
  highlightedTaskId,
  crewIdsInOrder,
  crewNamesById,
  onSelectTask,
  planningDate,
  isEditMode = false,
  className,
  onRefreshMap,
  isRefreshingMap = false,
  mapRefreshToken = 0,
  mapRefreshError = null,
  activeCrewFilterId = null,
  crews = [],
  allScopeTasks = [],
  reorderingTaskId = null,
  onMoveTaskToPosition,
}: PlanningMapProps) {
  const markers = buildPlanningMapMarkers(tasks)
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null
  const crewColorIndex = useMemo(
    () => buildPlanningCrewColorIndex(crewIdsInOrder),
    [crewIdsInOrder]
  )
  const crewLegendItems = useMemo(
    () => buildPlanningCrewLegendItems(crewIdsInOrder, crewNamesById),
    [crewIdsInOrder, crewNamesById]
  )

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm",
        className
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Mapa de planificación</h2>
          {mapRefreshError ? (
            <p className="text-xs text-destructive" role="alert">
              {mapRefreshError}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {markers.length} ubicación{markers.length === 1 ? "" : "es"} con GPS
              {activeCrewFilterId
                ? " · contexto completo con cuadrilla resaltada"
                : " · jornada completa"}
            </p>
          )}
        </div>
        {onRefreshMap ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-2"
            onClick={() => void onRefreshMap()}
            disabled={isRefreshingMap}
          >
            <RefreshCw
              className={cn("size-4", isRefreshingMap && "animate-spin")}
            />
            Actualizar mapa
          </Button>
        ) : null}
      </div>

      <div className="relative min-h-[15rem] flex-1">
        <PlanningMapCanvas
          markers={markers}
          selectedTaskId={selectedTaskId}
          highlightedTaskId={highlightedTaskId}
          crewColorIndex={crewColorIndex}
          onSelectTask={onSelectTask}
          isEditMode={isEditMode}
          viewRefreshToken={mapRefreshToken}
          activeCrewFilterId={activeCrewFilterId}
          crews={crews}
        />

        {selectedTask ? (
          <PlanningMapSelectedTaskOverlay
            task={selectedTask}
            isEditMode={isEditMode}
            allScopeTasks={allScopeTasks}
            crews={crews}
            reorderingTaskId={reorderingTaskId}
            onMoveTaskToPosition={onMoveTaskToPosition}
          />
        ) : null}
      </div>

      <PlanningMapLegend crewItems={crewLegendItems} />
    </section>
  )
}

export function formatPlanningDateLabel(dateInput: string): string {
  const [year, month, day] = dateInput.split("-").map(Number)
  if (!year || !month || !day) {
    return dateInput
  }

  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}
