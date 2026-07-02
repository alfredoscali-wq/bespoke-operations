"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { useAuth } from "@/components/auth/auth-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { PlanningAccessGuard } from "@/components/planificacion/planning-access-guard"
import { PlanningAlertsPanel } from "@/components/planificacion/planning-alerts-panel"
import { PlanningCrewPanel } from "@/components/planificacion/planning-crew-panel"
import { PlanningDispatchRoutesPanel } from "@/components/planificacion/planning-dispatch-routes-panel"
import { PlanningDispatchStatusBanner } from "@/components/planificacion/planning-dispatch-status-banner"
import { PlanningMap } from "@/components/planificacion/planning-map"
import { PlanningTaskEditPanel } from "@/components/planificacion/planning-task-edit-panel"
import { PlanningTaskList } from "@/components/planificacion/planning-task-list"
import { PlanningTaskReadonlyPanel } from "@/components/planificacion/planning-task-readonly-panel"
import { PlanningToolbar } from "@/components/planificacion/planning-toolbar"
import { useTasks } from "@/components/tareas/tasks-provider"
import { isCrewAssignable } from "@/lib/crews/status-workflow"
import { recordPlanningConfirmAudit } from "@/lib/planificacion/planning-audit"
import {
  clearPlanningConfirmSnapshot,
  readPlanningConfirmSnapshot,
  writePlanningConfirmSnapshot,
} from "@/lib/planificacion/planning-confirm-session"
import { evaluatePlanningConfirmReadiness } from "@/lib/planificacion/planning-confirm"
import {
  buildPlanningCrewRoutes,
  filterConfirmedDispatchTasksForPlanning,
  filterProgrammedTasksForPlanningDate,
  listReopenablePlanningTaskIds,
  resolvePlanningDispatchMode,
} from "@/lib/planificacion/planning-dispatch"
import {
  buildExecutionOrderPersistPlan,
  buildExecutionOrderSwapUpdates,
} from "@/lib/planificacion/planning-execution-order"
import { sortTasksByDispatchRoute } from "@/lib/tasks/dispatch-order"
import {
  resolveInitialPlanningFilters,
  writePlanningFiltersToSession,
} from "@/lib/planificacion/planning-filters-session"
import {
  buildPlanningCrewSummaries,
  computePlanningAlerts,
  filterProgrammedTasksForPlanning,
} from "@/lib/planificacion/planning-utils"

function PlanningModuleContent() {
  const { sessionUser } = useAuth()
  const { tasks, isTasksReady, editTask, confirmPlanningTasks, reopenPlanningTasks, refreshTasksFromServer } =
    useTasks()
  const { crews } = useCrews()
  const [initialFilters] = useState(resolveInitialPlanningFilters)
  const [date, setDate] = useState(initialFilters.date)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [reorderingTaskId, setReorderingTaskId] = useState<string | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [isConfirmingPlanning, setIsConfirmingPlanning] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [isReopeningPlanning, setIsReopeningPlanning] = useState(false)
  const [reopenError, setReopenError] = useState<string | null>(null)
  const [confirmSnapshotVersion, setConfirmSnapshotVersion] = useState(0)
  const [mapRefreshToken, setMapRefreshToken] = useState(0)
  const [isRefreshingMap, setIsRefreshingMap] = useState(false)
  const [mapRefreshError, setMapRefreshError] = useState<string | null>(null)

  useEffect(() => {
    writePlanningFiltersToSession({ date })
  }, [date])

  const dispatchMode = useMemo(
    () => resolvePlanningDispatchMode(tasks, date),
    [tasks, date]
  )

  const isConfirmedMode = dispatchMode === "confirmed"

  const confirmSnapshot = useMemo(() => {
    void confirmSnapshotVersion
    return readPlanningConfirmSnapshot(date)
  }, [date, confirmSnapshotVersion])

  const activeCrews = useMemo(
    () => crews.filter(isCrewAssignable),
    [crews]
  )

  const filteredTasks = useMemo(() => {
    if (isConfirmedMode) {
      return filterConfirmedDispatchTasksForPlanning(tasks, { date })
    }

    return filterProgrammedTasksForPlanning(tasks, { date })
  }, [tasks, date, isConfirmedMode])

  const sortedTasks = useMemo(
    () => sortTasksByDispatchRoute(filteredTasks, crews),
    [filteredTasks, crews]
  )

  const crewSummaries = useMemo(
    () => buildPlanningCrewSummaries(filteredTasks, activeCrews),
    [filteredTasks, activeCrews]
  )

  const crewRoutes = useMemo(
    () => buildPlanningCrewRoutes(filteredTasks, activeCrews),
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

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
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
  const isFocusMode = !isConfirmedMode && editingTaskId != null
  const isReadonlyDetailOpen = isConfirmedMode && selectedTaskId != null
  const showPlanningOverview = !isFocusMode && !isReadonlyDetailOpen

  function resetInteractionState() {
    setSelectedTaskId(null)
    setEditingTaskId(null)
  }

  const handleMoveExecutionOrder = useCallback(
    async (taskId: string, direction: "up" | "down") => {
      const scope = filterProgrammedTasksForPlanningDate(tasks, { date })
      const updates = buildExecutionOrderSwapUpdates(
        scope,
        taskId,
        direction,
        crews
      )

      if (updates.length === 0) {
        return
      }

      setReorderingTaskId(taskId)

      try {
        const plan = buildExecutionOrderPersistPlan(updates, scope)

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
    [tasks, date, crews, editTask]
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

      writePlanningConfirmSnapshot({
        date,
        confirmedAt: new Date().toISOString(),
        confirmedBy: sessionUser?.displayName?.trim() || "Supervisor",
      })
      setConfirmSnapshotVersion((current) => current + 1)

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
  }, [tasks, date, confirmPlanningTasks, sessionUser?.displayName])

  const handleModifyPlanning = useCallback(async () => {
    const reopenableIds = listReopenablePlanningTaskIds(tasks, date)

    if (reopenableIds.length === 0) {
      setReopenError(
        "No hay OT en estado Asignada para reabrir. Las OT ya iniciadas deben gestionarse desde Órdenes de Trabajo."
      )
      return
    }

    setIsReopeningPlanning(true)
    setReopenError(null)

    try {
      const result = await reopenPlanningTasks(reopenableIds)

      if (!result.success) {
        setReopenError(
          result.message ?? "No se pudo reabrir la planificación."
        )
        return
      }

      clearPlanningConfirmSnapshot(date)
      setConfirmSnapshotVersion((current) => current + 1)
      resetInteractionState()
    } catch (error) {
      console.error(error)
      setReopenError("No se pudo reabrir la planificación.")
    } finally {
      setIsReopeningPlanning(false)
    }
  }, [tasks, date, reopenPlanningTasks])

  const handleRefreshMap = useCallback(async () => {
    setMapRefreshError(null)
    setIsRefreshingMap(true)

    try {
      const result = await refreshTasksFromServer()

      if (!result.success) {
        setMapRefreshError(
          result.message ?? "No se pudo actualizar el mapa de planificación."
        )
        return
      }

      setMapRefreshToken((current) => current + 1)
    } finally {
      setIsRefreshingMap(false)
    }
  }, [refreshTasksFromServer])

  const mapProps = {
    tasks: sortedTasks,
    selectedTaskId,
    highlightedTaskId,
    crewIdsInOrder,
    crewNamesById,
    onSelectTask: setSelectedTaskId,
    planningDate: date,
    isEditMode: isFocusMode,
    onRefreshMap: handleRefreshMap,
    isRefreshingMap,
    mapRefreshToken,
  }

  if (!isTasksReady) {
    return (
      <div className="rounded-xl border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground">
        Cargando planificación...
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col gap-4">
      {isConfirmedMode ? (
        <PlanningDispatchStatusBanner date={date} snapshot={confirmSnapshot} />
      ) : null}

      <PlanningToolbar
        mode={dispatchMode}
        date={date}
        plannedCount={filteredTasks.length}
        confirmReadiness={confirmReadiness}
        isConfirming={isConfirmingPlanning}
        isReopening={isReopeningPlanning}
        reopenError={reopenError}
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
          setReopenError(null)
        }}
        onConfirmPlanning={handleConfirmPlanning}
        onModifyPlanning={handleModifyPlanning}
      />

      {!isConfirmedMode ? <PlanningAlertsPanel alerts={alerts} /> : null}

      {mapRefreshError ? (
        <p className="text-sm text-destructive" role="alert">
          {mapRefreshError}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {showPlanningOverview ? (
          <>
            <PlanningMap
              {...mapProps}
              className="min-h-[50vh] w-full shrink-0 xl:min-h-[560px]"
            />

            <div className="grid min-h-[320px] flex-1 gap-4 xl:grid-cols-[minmax(18rem,20rem)_minmax(0,1fr)]">
              <PlanningTaskList
                mode={dispatchMode}
                tasks={filteredTasks}
                crews={crews}
                selectedTaskId={selectedTaskId}
                reorderingTaskId={reorderingTaskId}
                onSelectTask={setSelectedTaskId}
                onOrganizeTask={isConfirmedMode ? undefined : setEditingTaskId}
                onMoveExecutionOrder={
                  isConfirmedMode ? undefined : handleMoveExecutionOrder
                }
                className="min-h-[320px] xl:min-h-0"
              />

              <div className="min-h-[320px] xl:min-h-0">
                {isConfirmedMode ? (
                  <PlanningDispatchRoutesPanel
                    routes={crewRoutes}
                    selectedTaskId={selectedTaskId}
                    onSelectTask={setSelectedTaskId}
                    className="h-full lg:w-full"
                  />
                ) : (
                  <PlanningCrewPanel
                    summaries={crewSummaries}
                    className="h-full lg:w-full"
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row">
            <PlanningMap
              {...mapProps}
              className="min-h-[420px] min-w-0 flex-1 xl:min-h-[520px]"
            />

            {isFocusMode ? (
              <div className="min-h-[420px] w-full shrink-0 overflow-hidden xl:w-96">
                <PlanningTaskEditPanel
                  key={editingTaskId}
                  task={editingTask}
                  allTasks={filteredTasks}
                  open={isFocusMode}
                  onClose={() => setEditingTaskId(null)}
                />
              </div>
            ) : null}

            {isReadonlyDetailOpen ? (
              <div className="min-h-[420px] w-full shrink-0 overflow-hidden xl:w-96">
                <PlanningTaskReadonlyPanel
                  key={selectedTaskId}
                  task={selectedTask}
                  open={isReadonlyDetailOpen}
                  onClose={() => setSelectedTaskId(null)}
                />
              </div>
            ) : null}
          </div>
        )}
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
