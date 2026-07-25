"use client"

import { useEffect, useMemo, useState } from "react"

import { PlanningTaskTableRow } from "@/components/planificacion/planning-task-table-row"
import { PlanningTravelSegmentRow } from "@/components/planificacion/planning-travel-segment-row"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  buildPlanningCrewColorIndex,
  PLANNING_CREW_PIN_COLORS,
  PLANNING_PIN_COLOR_NO_CREW,
} from "@/lib/planificacion/planning-map-markers"
import type { PlanningDispatchMode } from "@/lib/planificacion/planning-dispatch"
import {
  buildPlanningJourneyItems,
  PLANNING_BASE_LABEL,
  PLANNING_RETURN_TO_BASE_KEY,
  PLANNING_TRAVEL_FROM_PREVIOUS_KEY,
} from "@/lib/planificacion/planning-travel"
import { planningRepository } from "@/lib/engines/planning/repositories/PlanningRepository"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import { sortTasksByDispatchRoute } from "@/lib/tasks/dispatch-order"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"

const PLANNING_TABLE_COLUMN_COUNT = 9

type PlanningTaskListProps = {
  mode: PlanningDispatchMode
  tasks: Task[]
  allScopeTasks: Task[]
  crews: Pick<Crew, "id" | "name">[]
  crewIdsInOrder: string[]
  selectedTaskId: string | null
  /** OT open in adjust sheet — keep row visually active. */
  adjustingTaskId?: string | null
  reorderingTaskId?: string | null
  onSelectTask: (taskId: string) => void
  onEditTask?: (taskId: string) => void
  onReturnToAtencion?: (taskId: string) => void
  isTaskReturnable?: (task: Task) => boolean
  onMoveTaskToPosition?: (taskId: string, position: number) => void
  onTravelMinutesChange?: (input: {
    ownerTaskId: string
    field:
      | typeof PLANNING_TRAVEL_FROM_PREVIOUS_KEY
      | typeof PLANNING_RETURN_TO_BASE_KEY
    minutes: number
  }) => void | Promise<void>
  isTaskEditable?: (task: Task) => boolean
  activeCrewFilterName?: string | null
  /** Operational base display name for journey start/end headers. */
  operationalBaseName?: string | null
  className?: string
}

export function PlanningTaskList({
  mode,
  tasks,
  allScopeTasks,
  crews,
  crewIdsInOrder,
  selectedTaskId,
  adjustingTaskId = null,
  reorderingTaskId = null,
  onSelectTask,
  onEditTask,
  onReturnToAtencion,
  isTaskReturnable,
  onMoveTaskToPosition,
  onTravelMinutesChange,
  isTaskEditable,
  activeCrewFilterName = null,
  operationalBaseName = null,
  className,
}: PlanningTaskListProps) {
  const readOnly = mode === "confirmed"
  const [savingTravelId, setSavingTravelId] = useState<string | null>(null)

  const crewColorIndex = useMemo(
    () => buildPlanningCrewColorIndex(crewIdsInOrder),
    [crewIdsInOrder]
  )

  const sortedTasks = useMemo(
    () => sortTasksByDispatchRoute(tasks, crews),
    [tasks, crews]
  )

  const journeyItems = useMemo(
    () => buildPlanningJourneyItems(sortedTasks, crews),
    [sortedTasks, crews]
  )

  useEffect(() => {
    if (!selectedTaskId) {
      return
    }

    const row = document.getElementById(`planning-task-row-${selectedTaskId}`)
    if (!row) {
      return
    }

    const viewport = row.closest('[data-slot="scroll-area-viewport"]')
    if (!(viewport instanceof HTMLElement)) {
      return
    }

    const rowRect = row.getBoundingClientRect()
    const viewportRect = viewport.getBoundingClientRect()
    const isVisible =
      rowRect.top >= viewportRect.top && rowRect.bottom <= viewportRect.bottom

    if (!isVisible) {
      row.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [selectedTaskId, sortedTasks])

  const title = readOnly ? "Despacho confirmado" : "Órdenes de trabajo"
  const emptyMessage = activeCrewFilterName
    ? `No hay órdenes asignadas a ${activeCrewFilterName} para esta jornada.`
    : readOnly
      ? "No hay órdenes en el despacho confirmado para esta fecha."
      : "No hay órdenes programadas para la fecha seleccionada."
  const subtitle = activeCrewFilterName
    ? `${activeCrewFilterName} · ${sortedTasks.length} OT en la jornada`
    : readOnly
      ? "Todas las OT confirmadas para la jornada"
      : "Todas las OT programadas para la jornada"

  function resolveCrewBandColor(task: Task): string {
    const crewId = resolveTaskCrewId(task, crews)
    if (!crewId) {
      return PLANNING_PIN_COLOR_NO_CREW
    }

    const index = crewColorIndex.get(crewId)
    if (index === undefined) {
      return PLANNING_PIN_COLOR_NO_CREW
    }

    return PLANNING_CREW_PIN_COLORS[index % PLANNING_CREW_PIN_COLORS.length]
  }

  function isRowEditable(task: Task): boolean {
    if (readOnly) {
      return false
    }

    return isTaskEditable ? isTaskEditable(task) : true
  }

  const canEditTravel =
    !readOnly && Boolean(onTravelMinutesChange) && Boolean(isTaskEditable)

  return (
    <section
      className={cn(
        "flex min-h-0 h-full w-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm",
        className
      )}
    >
      <div className="border-b px-2.5 py-2">
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>

      <ScrollArea className="min-h-0 min-w-0 flex-1">
        {sortedTasks.length === 0 ? (
          <p className="px-2.5 py-6 text-center text-[13px] text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          <div className="w-full min-w-0">
            <table className="w-full table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-1" />
                <col className="w-11" />
                {/* OPS 2.4.7 — no arrow column; short OT code; airy Cliente/Localidad */}
                <col className="w-[4.25rem]" />
                <col className="w-[26%]" />
                <col />
                <col className="w-[4.5rem]" />
                <col className="w-[4rem]" />
                <col className="w-[6.75rem]" />
                <col className="w-14" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                <tr className="border-b text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="w-0 p-0" aria-hidden />
                  <th className="px-1 py-1 text-center">Orden</th>
                  <th className="px-1 py-1">Código OT</th>
                  <th className="px-1.5 py-1">Cliente</th>
                  <th className="px-1.5 py-1">Localidad</th>
                  <th className="px-1 py-1">Turno</th>
                  <th className="px-1 py-1">Duración</th>
                  <th className="px-1 py-1">Estado</th>
                  <th className="px-0.5 py-1" aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {journeyItems.map((item) => {
                  if (item.kind === "travel") {
                    const owner = sortedTasks.find(
                      (task) => task.id === item.ownerTaskId
                    )
                    const travelEditable =
                      canEditTravel &&
                      owner != null &&
                      isRowEditable(owner) &&
                      onTravelMinutesChange != null

                    const travelDistanceMeters =
                      owner == null
                        ? 0
                        : item.field === PLANNING_RETURN_TO_BASE_KEY
                          ? planningRepository.readReturnToBase(
                              owner.taskMetadata
                            ).distanceMeters
                          : planningRepository.readTravelFromPrevious(
                              owner.taskMetadata
                            ).distanceMeters
                    const isBaseLeg =
                      item.fromLabel === PLANNING_BASE_LABEL ||
                      item.toLabel === PLANNING_BASE_LABEL
                    const travelVariant =
                      item.fromLabel === PLANNING_BASE_LABEL
                        ? "journey-start"
                        : item.toLabel === PLANNING_BASE_LABEL
                          ? "journey-end"
                          : "connector"

                    return (
                      <PlanningTravelSegmentRow
                        key={item.id}
                        fromLabel={item.fromLabel}
                        toLabel={item.toLabel}
                        minutes={item.minutes}
                        distanceMeters={travelDistanceMeters}
                        isBaseLeg={isBaseLeg}
                        variant={travelVariant}
                        baseDisplayName={operationalBaseName}
                        colSpan={PLANNING_TABLE_COLUMN_COUNT}
                        readOnly={!travelEditable}
                        isSaving={savingTravelId === item.id}
                        onCommitMinutes={async (nextMinutes) => {
                          if (!onTravelMinutesChange) {
                            return
                          }
                          setSavingTravelId(item.id)
                          try {
                            await onTravelMinutesChange({
                              ownerTaskId: item.ownerTaskId,
                              field: item.field,
                              minutes: nextMinutes,
                            })
                          } finally {
                            setSavingTravelId(null)
                          }
                        }}
                      />
                    )
                  }

                  const task = item.task
                  const crewColor = resolveCrewBandColor(task)
                  const rowEditable = isRowEditable(task)
                  const rowReturnable = isTaskReturnable
                    ? isTaskReturnable(task)
                    : false

                  return (
                    <PlanningTaskTableRow
                      key={task.id}
                      task={task}
                      rowId={`planning-task-row-${task.id}`}
                      crewColor={crewColor}
                      readOnly={!rowEditable}
                      selected={
                        task.id === selectedTaskId ||
                        task.id === adjustingTaskId
                      }
                      isReordering={reorderingTaskId === task.id}
                      allScopeTasks={allScopeTasks}
                      crews={crews}
                      onSelect={() => onSelectTask(task.id)}
                      onEdit={
                        onEditTask && rowEditable
                          ? () => onEditTask(task.id)
                          : undefined
                      }
                      onReturnToAtencion={
                        onReturnToAtencion && rowReturnable
                          ? () => onReturnToAtencion(task.id)
                          : undefined
                      }
                      onMoveToPosition={
                        onMoveTaskToPosition && rowEditable
                          ? onMoveTaskToPosition
                          : undefined
                      }
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </ScrollArea>
    </section>
  )
}
