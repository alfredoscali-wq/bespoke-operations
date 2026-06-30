"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { PlanningAccessGuard } from "@/components/planificacion/planning-access-guard"
import { PlanningAlertsPanel } from "@/components/planificacion/planning-alerts-panel"
import { PlanningCrewPanel } from "@/components/planificacion/planning-crew-panel"
import { PlanningMap } from "@/components/planificacion/planning-map"
import { PlanningTaskEditPanel } from "@/components/planificacion/planning-task-edit-panel"
import { PlanningTaskList } from "@/components/planificacion/planning-task-list"
import { PlanningToolbar } from "@/components/planificacion/planning-toolbar"
import { useTasks } from "@/components/tareas/tasks-provider"
import { isCrewAssignable } from "@/lib/crews/status-workflow"
import { recordPlanningConfirmAudit } from "@/lib/planificacion/planning-audit"
import { evaluatePlanningConfirmReadiness } from "@/lib/planificacion/planning-confirm"
import {
  buildExecutionOrderPersistPlan,
  buildExecutionOrderSwapUpdates,
  sortTasksForPlanningList,
} from "@/lib/planificacion/planning-execution-order"
import {
  resolveInitialPlanningFilters,
  writePlanningFiltersToSession,
} from "@/lib/planificacion/planning-filters-session"
import {
  buildPlanningCrewSummaries,
  computePlanningAlerts,
  computePlanningKpis,
  filterProgrammedTasksForPlanning,
} from "@/lib/planificacion/planning-utils"
import { cn } from "@/lib/utils"

function PlanningModuleContent() {
  const { tasks, isTasksReady, editTask, confirmPlanningTasks } = useTasks()
  const { crews } = useCrews()
  const [initialFilters] = useState(resolveInitialPlanningFilters)
  const [date, setDate] = useState(initialFilters.date)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [reorderingTaskId, setReorderingTaskId] = useState<string | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [isConfirmingPlanning, setIsConfirmingPlanning] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  useEffect(() => {
    writePlanningFiltersToSession({ date })
  }, [date])

  const activeCrews = useMemo(
    () => crews.filter(isCrewAssignable),
    [crews]
  )

  const filteredTasks = useMemo(
    () => filterProgrammedTasksForPlanning(tasks, { date }),
    [tasks, date]
  )

  const sortedTasks = useMemo(
    () => sortTasksForPlanningList(filteredTasks, crews),
    [filteredTasks, crews]
  )

  const kpis = useMemo(
    () => computePlanningKpis(filteredTasks, activeCrews),
    [filteredTasks, activeCrews]
  )

  const crewSummaries = useMemo(
    () => buildPlanningCrewSummaries(filteredTasks, activeCrews),
    [filteredTasks, activeCrews]
  )

  const alerts = useMemo(
    () => computePlanningAlerts(filteredTasks, crewSummaries),
    [filteredTasks, crewSummaries]
  )

  const confirmReadiness = useMemo(
    () => evaluatePlanningConfirmReadiness(tasks, date),
    [tasks, date]
  )

  const editingTask = useMemo(
    () => tasks.find((task) => task.id === editingTaskId) ?? null,
    [tasks, editingTaskId]
  )

  const crewIdsInOrder = useMemo(
    () => activeCrews.map((crew) => crew.id),
    [activeCrews]
  )

  const crewNamesById = useMemo(
    () =>
      Object.fromEntries(
        activeCrews.map((crew) => [crew.id, crew.name] as const)
      ),
    [activeCrews]
  )

  const highlightedTaskId = selectedTaskId ?? editingTaskId
  const isFocusMode = editingTaskId != null

  function resetInteractionState() {
    setSelectedTaskId(null)
    setEditingTaskId(null)
  }

  const handleMoveExecutionOrder = useCallback(
    async (taskId: string, direction: "up" | "down") => {
      const updates = buildExecutionOrderSwapUpdates(
        filteredTasks,
        taskId,
        direction,
        crews
      )

      if (updates.length === 0) {
        return
      }

      setReorderingTaskId(taskId)

      try {
        const plan = buildExecutionOrderPersistPlan(updates, filteredTasks)

        for (const phase of plan.phases) {
          for (const update of phase) {
            const result = await editTask(update.taskId, {
              executionOrder: update.executionOrder,
            })

            if (!result.success) {
              throw new Error(
                result.message ?? "No se pudo actualizar el orden de ejecución."
              )
            }
          }
        }
      } catch (error) {
        console.error(error)
      } finally {
        setReorderingTaskId(null)
      }
    },
    [filteredTasks, crews, editTask]
  )

  const handleConfirmPlanning = useCallback(async () => {
    const readiness = evaluatePlanningConfirmReadiness(tasks, date)

    if (!readiness.canConfirm) {
      setConfirmError(
        readiness.validationError ??
          readiness.disabledReason ??
          "No se puede confirmar la planificación."
      )
      return
    }

    setIsConfirmingPlanning(true)
    setConfirmError(null)

    try {
      const result = await confirmPlanningTasks(readiness.taskIds)

      if (!result.success) {
        setConfirmError(
          result.message ?? "No se pudo confirmar la planificación."
        )
        return
      }

      setConfirmDialogOpen(false)
      resetInteractionState()
      recordPlanningConfirmAudit({
        date,
        taskCount: readiness.taskCount,
      })
    } catch (error) {
      console.error(error)
      setConfirmError("No se pudo confirmar la planificación.")
    } finally {
      setIsConfirmingPlanning(false)
    }
  }, [tasks, date, confirmPlanningTasks])

  if (!isTasksReady) {
    return (
      <div className="rounded-xl border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground">
        Cargando planificación operativa...
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col gap-4">
      <PlanningToolbar
        date={date}
        kpis={kpis}
        confirmReadiness={confirmReadiness}
        isConfirming={isConfirmingPlanning}
        confirmError={confirmError}
        confirmDialogOpen={confirmDialogOpen}
        onConfirmDialogOpenChange={(open) => {
          setConfirmDialogOpen(open)
          if (!open) {
            setConfirmError(null)
          }
        }}
        onDateChange={(nextDate) => {
          setDate(nextDate)
          resetInteractionState()
          setConfirmError(null)
        }}
        onConfirmPlanning={handleConfirmPlanning}
      />

      <PlanningAlertsPanel alerts={alerts} />

      <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row">
        <div
          aria-hidden={isFocusMode}
          className={cn(
            "min-h-0 shrink-0 overflow-hidden transition-all duration-300 ease-in-out",
            isFocusMode
              ? "pointer-events-none max-h-0 opacity-0 xl:max-h-none xl:w-0 xl:opacity-0"
              : "max-h-[2000px] w-full opacity-100 xl:w-80"
          )}
        >
          <PlanningTaskList
            tasks={filteredTasks}
            crews={crews}
            selectedTaskId={selectedTaskId}
            reorderingTaskId={reorderingTaskId}
            onSelectTask={setSelectedTaskId}
            onEditTask={setEditingTaskId}
            onMoveExecutionOrder={handleMoveExecutionOrder}
          />
        </div>

        <PlanningMap
          tasks={sortedTasks}
          selectedTaskId={selectedTaskId}
          highlightedTaskId={highlightedTaskId}
          crewIdsInOrder={crewIdsInOrder}
          crewNamesById={crewNamesById}
          onSelectTask={setSelectedTaskId}
          planningDate={date}
          isEditMode={isFocusMode}
          className="min-h-[420px] min-w-0 flex-1 transition-all duration-300 ease-in-out"
        />

        {isFocusMode ? (
          <div className="min-h-[420px] w-full shrink-0 overflow-hidden transition-all duration-300 ease-in-out xl:w-96">
            <PlanningTaskEditPanel
              key={editingTaskId}
              task={editingTask}
              allTasks={filteredTasks}
              open={isFocusMode}
              onClose={() => setEditingTaskId(null)}
            />
          </div>
        ) : null}

        <div
          aria-hidden={isFocusMode}
          className={cn(
            "min-h-0 shrink-0 overflow-hidden transition-all duration-300 ease-in-out",
            isFocusMode
              ? "pointer-events-none max-h-0 opacity-0 xl:max-h-none xl:w-0 xl:opacity-0"
              : "max-h-[2000px] w-full opacity-100 xl:w-72"
          )}
        >
          <PlanningCrewPanel summaries={crewSummaries} />
        </div>
      </div>
    </div>
  )
}

export function PlanningModule() {
  return (
    <PlanningAccessGuard>
      <PlanningModuleContent />
    </PlanningAccessGuard>
  )
}
