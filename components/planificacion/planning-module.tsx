"use client"



import { useCallback, useEffect, useMemo, useState } from "react"
import { isWorkOrderTask } from "@/lib/tasks/work-order"
import {
  countOperationallyOverdueTasks,
  filterOperationallyOverdueTasks,
} from "@/lib/tasks/operational-overdue"



import { useAuth } from "@/components/auth/auth-provider"

import { useCrews } from "@/components/cuadrillas/crews-provider"

import { PlanningAccessGuard } from "@/components/planificacion/planning-access-guard"

import { PlanningMap } from "@/components/planificacion/planning-map"

import { PlanningOperationalSummary } from "@/components/planificacion/planning-operational-summary"

import { PlanningOperationalAlerts } from "@/components/planificacion/planning-operational-alerts"

import { PlanningIncidentsSheet } from "@/components/planificacion/planning-incidents-sheet"

import { PlanningPendingClosureSheet } from "@/components/planificacion/planning-pending-closure-sheet"

import { PlanningSuccessBanner } from "@/components/planificacion/planning-success-banner"

import { PlanningTaskAdjustSheet } from "@/components/planificacion/planning-task-adjust-sheet"
import { PlanningReturnToAtencionDialog } from "@/components/planificacion/planning-return-to-atencion-dialog"

import { PlanningTaskList } from "@/components/planificacion/planning-task-list"

import { PlanningJourneySummaryPanel } from "@/components/planificacion/planning-journey-summary-panel"

import { PlanningDayConfigPanel } from "@/components/planificacion/planning-day-config-panel"

import { PlanningPrintMaterialsDialog } from "@/components/planificacion/planning-print-materials-dialog"

import { PlanningToolbar } from "@/components/planificacion/planning-toolbar"

import { useTasks } from "@/components/tareas/tasks-provider"

import { isCrewAssignable } from "@/lib/crews/status-workflow"

import { recordPlanningConfirmAudit } from "@/lib/planificacion/planning-audit"

import {

  evaluatePlanningCrewConfirmReadiness,

} from "@/lib/planificacion/planning-confirm"

import {

  filterConfirmedDispatchTasksForPlanning,

  filterProgrammedTasksForPlanningDate,

} from "@/lib/planificacion/planning-dispatch"

import {

  buildExecutionOrderPositionUpdates,

  buildExecutionOrderSwapUpdates,

} from "@/lib/planificacion/planning-execution-order"

import {

  resolveInitialPlanningFilters,

  writePlanningFiltersToSession,

} from "@/lib/planificacion/planning-filters-session"

import {

  buildPlanningDispatchSuccessMessage,

  type PlanningSuccessMessage,

} from "@/lib/planificacion/planning-success-message"

import {

  filterPlanningOperationalViewTasks,

  isJourneyFullyPlanned,

  isTaskPlanningEditable,

  listReopenablePlanningTaskIdsForCrew,

  resolveCrewPlanningButtonVisibility,

  type CrewPlanningButtonVisibility,

} from "@/lib/planificacion/planning-crew-state"

import {
  buildPlanningCrewSummaries,
  filterPlanningTasksByCrewFilter,
  resolveTaskPlanningCoordinates,
} from "@/lib/planificacion/planning-utils"

import { calculatePlanningSummary } from "@/lib/planificacion/planning-summary"

import {
  readPlanningDayOperationalOverride,
  resolvePlanningDayOperationalConfig,
  validatePlanningDayOperationalOverride,
  writePlanningDayOperationalOverride,
} from "@/lib/planificacion/planning-day-config"

import {
  planningRepository,
} from "@/lib/engines/planning/repositories/PlanningRepository"
import { resolveCrewOperationalBase } from "@/lib/crews/operational-config"
import {
  listOrderedTasksForCrewJourney,
  PLANNING_RETURN_TO_BASE_KEY,
  PLANNING_TRAVEL_FROM_PREVIOUS_KEY,
} from "@/lib/planificacion/planning-travel"
import { recalculatePlanningRoutesForCrew } from "@/lib/planificacion/planning-route-recalc.client"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import { sortTasksByDispatchRoute, resolveTaskRouteOrder } from "@/lib/tasks/dispatch-order"
import { canReturnPlanningTaskToAtencion } from "@/lib/tasks/planning-return"

import { listPendingClosureTasksForPlanningDate } from "@/lib/planificacion/planning-pending-closure"

import { usePlanningActiveIncidents } from "@/hooks/use-planning-active-incidents"
import { usePlanningOperationalPolling } from "@/hooks/use-planning-operational-polling"



function PlanningModuleContent() {

  const { sessionUser } = useAuth()

  const { tasks, isTasksReady, applyExecutionOrderUpdates, confirmPlanningTasks, reopenPlanningTasks, returnPlanningTaskToAtencion, refreshTasksFromServer, editTask } =

    useTasks()

  const { crews } = useCrews()

  const [initialFilters] = useState(resolveInitialPlanningFilters)

  const [date, setDate] = useState(initialFilters.date)

  const [crewFilterId, setCrewFilterId] = useState<string | null>(

    initialFilters.crewFilterId ?? null

  )

  const [overdueFilterActive, setOverdueFilterActive] = useState(false)

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const [adjustSheetTaskId, setAdjustSheetTaskId] = useState<string | null>(null)
  const [returnDialogTaskId, setReturnDialogTaskId] = useState<string | null>(null)
  const [isReturningToAtencion, setIsReturningToAtencion] = useState(false)

  const [reorderingTaskId, setReorderingTaskId] = useState<string | null>(null)

  const [dayConfigRevision, setDayConfigRevision] = useState(0)

  const [processingCrewId, setProcessingCrewId] = useState<string | null>(null)

  const [crewActionError, setCrewActionError] = useState<string | null>(null)

  const [dispatchError, setDispatchError] = useState<string | null>(null)

  const [successMessage, setSuccessMessage] = useState<PlanningSuccessMessage | null>(null)

  const [mapRefreshToken, setMapRefreshToken] = useState(0)

  const [isRefreshingMap, setIsRefreshingMap] = useState(false)

  const [mapRefreshError, setMapRefreshError] = useState<string | null>(null)

  const [pendingClosureSheetOpen, setPendingClosureSheetOpen] = useState(false)

  const [selectedPlanningPendingClosureTaskId, setSelectedPlanningPendingClosureTaskId] =
    useState<string | null>(null)

  const [incidentsSheetOpen, setIncidentsSheetOpen] = useState(false)

  const [printMaterialsOpen, setPrintMaterialsOpen] = useState(false)

  const [selectedPlanningIncidentId, setSelectedPlanningIncidentId] = useState<
    string | null
  >(null)



  const supervisorName = sessionUser?.displayName?.trim() || "Supervisor"

  const {
    incidents: activeIncidents,
    activeCount: activeIncidentsCount,
    isLoading: isActiveIncidentsLoading,
    error: activeIncidentsError,
    refresh: refreshActiveIncidents,
  } = usePlanningActiveIncidents()

  usePlanningOperationalPolling({
    enabled: isTasksReady,
    refreshTasksFromServer,
    refreshActiveIncidents,
  })



  const activeCrews = useMemo(

    () => crews.filter(isCrewAssignable),

    [crews]

  )



  const isConfirmedMode = useMemo(

    () => isJourneyFullyPlanned(tasks, date, activeCrews),

    [tasks, date, activeCrews]

  )



  const dispatchMode = isConfirmedMode ? "confirmed" : "editing"

  const isEditingMode = !isConfirmedMode



  useEffect(() => {

    writePlanningFiltersToSession({ date, crewFilterId })

  }, [date, crewFilterId])



  useEffect(() => {

    if (

      crewFilterId &&

      !activeCrews.some((crew) => crew.id === crewFilterId)

    ) {

      setCrewFilterId(null)

    }

  }, [activeCrews, crewFilterId])



  const overdueCount = useMemo(
    () => countOperationallyOverdueTasks(tasks.filter(isWorkOrderTask)),
    [tasks]
  )

  const filteredTasks = useMemo(() => {
    if (overdueFilterActive) {
      return filterOperationallyOverdueTasks(tasks.filter(isWorkOrderTask))
    }

    if (isConfirmedMode) {
      return filterConfirmedDispatchTasksForPlanning(tasks, { date })
    }

    return filterPlanningOperationalViewTasks(tasks, { date })
  }, [tasks, date, isConfirmedMode, overdueFilterActive])



  const sortedTasks = useMemo(

    () => sortTasksByDispatchRoute(filteredTasks, crews),

    [filteredTasks, crews]

  )



  const listTasks = useMemo(

    () =>

      filterPlanningTasksByCrewFilter(

        filteredTasks,

        crewFilterId,

        activeCrews

      ),

    [filteredTasks, crewFilterId, activeCrews]

  )



  const journeySummary = useMemo(

    () => {

      const filteredCrew =
        crewFilterId != null
          ? activeCrews.find((crew) => crew.id === crewFilterId) ?? null
          : null

      const dayOverride =
        filteredCrew != null
          ? readPlanningDayOperationalOverride(date, filteredCrew.id)
          : null

      const dayConfig =
        filteredCrew != null
          ? resolvePlanningDayOperationalConfig({
              crew: filteredCrew,
              override: dayOverride,
            })
          : null

      return calculatePlanningSummary({
        tasks: listTasks,
        crews: filteredCrew ? [filteredCrew] : activeCrews,
        groupByCrew: !crewFilterId,
        availableMinutes: dayConfig?.availableMinutes,
      })
    },

    [listTasks, activeCrews, crewFilterId, date, dayConfigRevision]

  )

  const planningDayConfig = useMemo(() => {
    if (!crewFilterId) {
      return null
    }
    const crew = activeCrews.find((entry) => entry.id === crewFilterId)
    if (!crew) {
      return null
    }
    return {
      crew,
      config: resolvePlanningDayOperationalConfig({
        crew,
        override: readPlanningDayOperationalOverride(date, crew.id),
      }),
    }
  }, [crewFilterId, activeCrews, date, dayConfigRevision])

  const crewSummaries = useMemo(

    () => buildPlanningCrewSummaries(filteredTasks, activeCrews),

    [filteredTasks, activeCrews]

  )



  const crewPlanningButtonsById = useMemo(() => {

    const visibility: Record<string, CrewPlanningButtonVisibility> = {}



    for (const summary of crewSummaries) {

      const buttons = resolveCrewPlanningButtonVisibility(

        tasks,

        date,

        summary.crew

      )

      if (buttons) {

        visibility[summary.crew.id] = buttons

      }

    }



    return visibility

  }, [crewSummaries, tasks, date])



  const planningOrderScopeTasks = useMemo(

    () => filterProgrammedTasksForPlanningDate(tasks, { date }),

    [tasks, date]

  )



  const pendingClosureTasks = useMemo(

    () => listPendingClosureTasksForPlanningDate(tasks, date, activeCrews),

    [tasks, date, activeCrews]

  )



  const adjustTask = useMemo(

    () => tasks.find((task) => task.id === adjustSheetTaskId) ?? null,

    [tasks, adjustSheetTaskId]

  )

  const returnDialogTask = useMemo(

    () => tasks.find((task) => task.id === returnDialogTaskId) ?? null,

    [tasks, returnDialogTaskId]

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



  const activeCrewFilterName = crewFilterId

    ? crewNamesById[crewFilterId]?.trim() || null

    : null



  const runAutomaticRouteRecalc = useCallback(
    async (crewId: string, scopeTasks: typeof listTasks) => {
      const taskIds = scopeTasks
        .filter((task) => resolveTaskCrewId(task, crews) === crewId)
        .map((task) => task.id)

      if (taskIds.length === 0) {
        return
      }

      const result = await recalculatePlanningRoutesForCrew({
        crewId,
        taskIds,
      })

      if (!result.success) {
        // Soft-fail: keep planning usable.
        console.warn("[planning/route] client_recalc_failed", result.message)
        return
      }

      if (result.updatedTaskIds.length > 0) {
        await refreshTasksFromServer()
      }
    },
    [crews, refreshTasksFromServer]
  )

  const routeStructureKey = useMemo(() => {
    if (!crewFilterId) {
      return null
    }
    const crew = activeCrews.find((entry) => entry.id === crewFilterId)
    if (!crew) {
      return null
    }
    const base = resolveCrewOperationalBase(crew)
    const ordered = listOrderedTasksForCrewJourney(
      listTasks,
      crewFilterId,
      crews
    )
    return JSON.stringify({
      crewId: crewFilterId,
      base: base
        ? [base.latitude, base.longitude]
        : null,
      legs: ordered.map((task) => {
        const coords = resolveTaskPlanningCoordinates(task)
        return [
          task.id,
          coords?.latitude ?? null,
          coords?.longitude ?? null,
        ]
      }),
    })
  }, [crewFilterId, activeCrews, listTasks, crews])

  useEffect(() => {
    if (!isTasksReady || !crewFilterId || !routeStructureKey) {
      return
    }
    void runAutomaticRouteRecalc(crewFilterId, listTasks)
    // Structural key drives recalc; avoid loops when only travel metadata refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listTasks read when structure changes
  }, [isTasksReady, crewFilterId, routeStructureKey, runAutomaticRouteRecalc])

  const handleMoveTaskOrder = useCallback(

    async (taskId: string, direction: "up" | "down") => {

      const updates = buildExecutionOrderSwapUpdates(

        planningOrderScopeTasks,

        taskId,

        direction,

        crews

      )



      if (updates.length === 0) {

        return

      }



      setReorderingTaskId(taskId)



      try {

        const result = await applyExecutionOrderUpdates(updates, crews)



        if (!result.success) {

          throw new Error(

            result.message ?? "No se pudo actualizar el orden operativo."

          )

        }

        const moved = planningOrderScopeTasks.find((entry) => entry.id === taskId)
        const movedCrewId = moved ? resolveTaskCrewId(moved, crews) : null
        if (movedCrewId) {
          void runAutomaticRouteRecalc(movedCrewId, planningOrderScopeTasks)
        }

      } catch (error) {

        console.error(error)

        setDispatchError(

          error instanceof Error

            ? error.message

            : "No se pudo actualizar el orden operativo."

        )

      } finally {

        setReorderingTaskId(null)

      }

    },

    [planningOrderScopeTasks, crews, applyExecutionOrderUpdates, runAutomaticRouteRecalc]

  )



  const handleTravelMinutesChange = useCallback(

    async (input: {
      ownerTaskId: string
      field:
        | typeof PLANNING_TRAVEL_FROM_PREVIOUS_KEY
        | typeof PLANNING_RETURN_TO_BASE_KEY
      minutes: number
    }) => {
      const owner = tasks.find((task) => task.id === input.ownerTaskId)
      if (!owner) {
        return
      }

      const crewId = resolveTaskCrewId(owner, crews)
      const crew = crewId
        ? activeCrews.find((entry) => entry.id === crewId) ?? null
        : null
      const base = crew ? resolveCrewOperationalBase(crew) : null
      const ordered = crewId
        ? listOrderedTasksForCrewJourney(listTasks, crewId, crews)
        : [owner]
      const ownerIndex = ordered.findIndex((task) => task.id === owner.id)

      if (input.field === PLANNING_TRAVEL_FROM_PREVIOUS_KEY) {
        const destination = resolveTaskPlanningCoordinates(owner)
        const origin =
          ownerIndex <= 0
            ? base
              ? { latitude: base.latitude, longitude: base.longitude }
              : null
            : (() => {
                const previous = resolveTaskPlanningCoordinates(
                  ordered[ownerIndex - 1]
                )
                return previous
                  ? {
                      latitude: previous.latitude,
                      longitude: previous.longitude,
                    }
                  : null
              })()

        if (!origin || !destination) {
          setDispatchError(
            "No se pueden guardar traslados sin coordenadas de origen y destino."
          )
          return
        }

        const result = await editTask(owner.id, {
          taskMetadata: planningRepository.mergeTravelFromPrevious(
            owner.taskMetadata,
            {
              minutes: input.minutes,
              distanceMeters: planningRepository.readTravelFromPrevious(
                owner.taskMetadata
              ).distanceMeters,
              source: "MANUAL",
              origin,
              destination: {
                latitude: destination.latitude,
                longitude: destination.longitude,
              },
            }
          ),
        })
        if (!result.success) {
          setDispatchError(
            result.message ?? "No se pudo guardar el tiempo de traslado."
          )
        }
        return
      }

      if (!base) {
        setDispatchError(
          "Configurá la Base Operativa de la cuadrilla para registrar el regreso."
        )
        return
      }

      const last = ordered[ordered.length - 1] ?? owner
      const originCoords = resolveTaskPlanningCoordinates(last)
      if (!originCoords) {
        setDispatchError("La última OT no tiene coordenadas GPS.")
        return
      }

      const origin = {
        latitude: originCoords.latitude,
        longitude: originCoords.longitude,
      }
      const destination = {
        latitude: base.latitude,
        longitude: base.longitude,
      }

      // Clear stray return metadata, then write MANUAL on current last.
      for (const task of ordered) {
        if (task.id === last.id) {
          continue
        }
        if (task.taskMetadata?.return_to_base_minutes != null) {
          await editTask(task.id, {
            taskMetadata: planningRepository.clearReturnToBase(task.taskMetadata),
          })
        }
      }

      const result = await editTask(last.id, {
        taskMetadata: planningRepository.mergeReturnToBase(last.taskMetadata, {
          minutes: input.minutes,
          distanceMeters: planningRepository.readReturnToBase(last.taskMetadata)
            .distanceMeters,
          source: "MANUAL",
          origin,
          destination,
        }),
      })
      if (!result.success) {
        setDispatchError(
          result.message ?? "No se pudo guardar el regreso a base."
        )
      }
    },
    [tasks, crews, listTasks, editTask, activeCrews]
  )

  const handleMoveTaskToPosition = useCallback(

    async (taskId: string, targetPosition: number) => {

      const task = planningOrderScopeTasks.find((entry) => entry.id === taskId)

      if (!task) {

        return

      }



      const currentOrder = resolveTaskRouteOrder(task)

      if (currentOrder === targetPosition) {

        return

      }



      const updates = buildExecutionOrderPositionUpdates(

        planningOrderScopeTasks,

        taskId,

        targetPosition,

        crews

      )



      if (updates.length === 0) {

        return

      }



      setReorderingTaskId(taskId)



      try {

        const result = await applyExecutionOrderUpdates(updates, crews)



        if (!result.success) {

          throw new Error(

            result.message ?? "No se pudo actualizar el orden operativo."

          )

        }

        const movedCrewId = resolveTaskCrewId(task, crews)
        if (movedCrewId) {
          void runAutomaticRouteRecalc(movedCrewId, planningOrderScopeTasks)
        }

      } catch (error) {

        console.error(error)

        setDispatchError(

          error instanceof Error

            ? error.message

            : "No se pudo actualizar el orden operativo."

        )

      } finally {

        setReorderingTaskId(null)

      }

    },

    [planningOrderScopeTasks, crews, applyExecutionOrderUpdates, runAutomaticRouteRecalc]

  )



  const handleReturnToAtencion = useCallback(
    async (reason: string) => {
      if (!returnDialogTask) {
        return
      }

      setIsReturningToAtencion(true)
      setDispatchError(null)

      try {
        const result = await returnPlanningTaskToAtencion(
          returnDialogTask.id,
          { reason },
          crews
        )

        if (!result.success) {
          setDispatchError(
            result.message ??
              "No fue posible devolver la OT a Atención al Cliente."
          )
          return
        }

        if (selectedTaskId === returnDialogTask.id) {
          setSelectedTaskId(null)
        }

        if (adjustSheetTaskId === returnDialogTask.id) {
          setAdjustSheetTaskId(null)
        }

        setReturnDialogTaskId(null)
        setSuccessMessage({
          id: crypto.randomUUID(),
          title: "OT devuelta a Atención",
          description:
            "La orden salió de Planificación y quedó disponible en Órdenes de Trabajo.",
        })

        const returnedCrewId = resolveTaskCrewId(returnDialogTask, crews)
        if (returnedCrewId) {
          const remaining = listTasks.filter(
            (task) => task.id !== returnDialogTask.id
          )
          void runAutomaticRouteRecalc(returnedCrewId, remaining)
        }
      } finally {
        setIsReturningToAtencion(false)
      }
    },
    [
      adjustSheetTaskId,
      crews,
      listTasks,
      returnDialogTask,
      returnPlanningTaskToAtencion,
      runAutomaticRouteRecalc,
      selectedTaskId,
    ]
  )

  const handlePlanCrew = useCallback(

    async (crewId: string) => {

      const crew = activeCrews.find((entry) => entry.id === crewId)

      if (!crew) {

        return

      }



      const readiness = evaluatePlanningCrewConfirmReadiness(tasks, date, crew)



      if (!readiness.canConfirm) {

        setCrewActionError(

          readiness.validationError ??

            readiness.disabledReason ??

            "No se puede planificar esta cuadrilla."

        )

        return

      }



      setProcessingCrewId(crewId)

      setCrewActionError(null)



      try {

        const confirmedAt = new Date().toISOString()

        const result = await confirmPlanningTasks(readiness.taskIds, activeCrews)



        if (!result.success) {

          setCrewActionError(

            result.message ?? "No se pudo planificar la cuadrilla."

          )

          return

        }



        recordPlanningConfirmAudit({

          date,

          taskCount: readiness.taskCount,

          crewName: crew.name,

          scope: "crew",

        })

        setSuccessMessage(

          buildPlanningDispatchSuccessMessage({

            id: crypto.randomUUID(),

            scopeLabel: `✓ Planificada · ${crew.name}`,

            supervisor: supervisorName,

            date,

            confirmedAt,

            taskCount: readiness.taskCount,

          })

        )

      } catch (error) {

        console.error(error)

        setCrewActionError("No se pudo planificar la cuadrilla.")

      } finally {

        setProcessingCrewId(null)

      }

    },

    [tasks, date, activeCrews, confirmPlanningTasks, supervisorName]

  )



  const handleModifyCrew = useCallback(

    async (crewId: string) => {

      const crew = activeCrews.find((entry) => entry.id === crewId)

      if (!crew) {

        return

      }



      const reopenableIds = listReopenablePlanningTaskIdsForCrew(tasks, date, crew)



      if (reopenableIds.length === 0) {

        setCrewActionError(

          "No hay OT asignadas para replanificar en esta cuadrilla."

        )

        return

      }



      setProcessingCrewId(crewId)

      setCrewActionError(null)



      try {

        const result = await reopenPlanningTasks(reopenableIds, activeCrews)



        if (!result.success) {

          setCrewActionError(

            result.message ?? "No se pudo replanificar la cuadrilla."

          )

          return

        }



        setAdjustSheetTaskId(null)

        setSuccessMessage(

          buildPlanningDispatchSuccessMessage({

            id: crypto.randomUUID(),

            scopeLabel: `Planificación editable · ${crew.name}`,

            supervisor: supervisorName,

            date,

            confirmedAt: new Date().toISOString(),

            taskCount: reopenableIds.length,

          })

        )

      } catch (error) {

        console.error(error)

        setCrewActionError(

          "No se pudo replanificar la cuadrilla."

        )

      } finally {

        setProcessingCrewId(null)

      }

    },

    [tasks, date, reopenPlanningTasks, supervisorName]

  )



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

    highlightedTaskId: selectedTaskId,

    crewIdsInOrder,

    crewNamesById,

    onSelectTask: setSelectedTaskId,

    planningDate: date,

    isEditMode: isEditingMode,

    onRefreshMap: handleRefreshMap,

    isRefreshingMap,

    mapRefreshToken,

    activeCrewFilterId: crewFilterId,

    crews: activeCrews,

    allScopeTasks: planningOrderScopeTasks,

    reorderingTaskId,

    onMoveTaskToPosition: isEditingMode ? handleMoveTaskToPosition : undefined,

  }



  if (!isTasksReady) {

    return (

      <div className="rounded-xl border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground">

        Cargando planificación...

      </div>

    )

  }



  return (

    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-2">

      <PlanningToolbar

        date={date}

        onDateChange={(nextDate) => {

          setDate(nextDate)

          setCrewFilterId(null)

          setSelectedTaskId(null)

          setAdjustSheetTaskId(null)

          setDispatchError(null)

          setCrewActionError(null)

          setSuccessMessage(null)

        }}

        onPrintMaterials={() => setPrintMaterialsOpen(true)}

      />



      <PlanningSuccessBanner

        message={successMessage}

        onDismiss={() => setSuccessMessage(null)}

      />



      {dispatchError ? (

        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">

          {dispatchError}

        </p>

      ) : null}



      <div className="flex min-h-0 flex-1 flex-col gap-2">

        <PlanningOperationalSummary

          programmedCount={filteredTasks.length}

          overdueCount={overdueCount}

          overdueFilterActive={overdueFilterActive}

          crewSummaries={crewSummaries}

          crewIdsInOrder={crewIdsInOrder}

          crewNamesById={crewNamesById}

          activeCrewFilterId={crewFilterId}

          crewPlanningButtonsById={crewPlanningButtonsById}

          isEditingMode={isEditingMode}

          processingCrewId={processingCrewId}

          crewActionError={crewActionError}

          onSelectAll={() => {

            setCrewFilterId(null)

            setOverdueFilterActive(false)

            setCrewActionError(null)

          }}

          onSelectOverdue={() => {

            setCrewFilterId(null)

            setOverdueFilterActive(true)

            setCrewActionError(null)

          }}

          onSelectCrew={(crewId) => {

            setCrewFilterId(crewId)

            setOverdueFilterActive(false)

            setCrewActionError(null)

          }}

          onPlanCrew={handlePlanCrew}

          onModifyCrew={handleModifyCrew}

        />



        <PlanningOperationalAlerts

          pendingApprovalCount={pendingClosureTasks.length}

          onOpenPendingApproval={() => setPendingClosureSheetOpen(true)}

          activeIncidentsCount={activeIncidentsCount}

          onOpenIncidents={() => setIncidentsSheetOpen(true)}

        />



        <PlanningIncidentsSheet

          open={incidentsSheetOpen}

          onOpenChange={(nextOpen) => {

            setIncidentsSheetOpen(nextOpen)

            if (!nextOpen) {

              setSelectedPlanningIncidentId(null)

            }

          }}

          incidents={activeIncidents}

          isLoading={isActiveIncidentsLoading}

          error={activeIncidentsError}

          onRefresh={refreshActiveIncidents}

          selectedIncidentId={selectedPlanningIncidentId}

          onSelectedIncidentIdChange={setSelectedPlanningIncidentId}

        />



        <PlanningPendingClosureSheet

          open={pendingClosureSheetOpen}

          onOpenChange={(nextOpen) => {

            setPendingClosureSheetOpen(nextOpen)

            if (!nextOpen) {

              setSelectedPlanningPendingClosureTaskId(null)

            }

          }}

          date={date}

          selectedTaskId={selectedPlanningPendingClosureTaskId}

          onSelectedTaskIdChange={setSelectedPlanningPendingClosureTaskId}

        />



        <div className="flex min-h-0 flex-1 flex-col gap-2 lg:grid lg:grid-rows-[minmax(18rem,1.25fr)_minmax(14rem,1fr)]">

          <PlanningMap

            {...mapProps}

            mapRefreshError={mapRefreshError}

            className="min-h-[18rem] shrink-0 lg:min-h-[18rem]"

          />



          <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row">

            <PlanningTaskList

              mode={dispatchMode}

              tasks={listTasks}

              allScopeTasks={planningOrderScopeTasks}

              crews={crews}

              crewIdsInOrder={crewIdsInOrder}

              selectedTaskId={selectedTaskId}

              reorderingTaskId={reorderingTaskId}

              onSelectTask={setSelectedTaskId}

              onEditTask={

                isEditingMode

                  ? (taskId) => {

                      const task = tasks.find((entry) => entry.id === taskId)

                      if (task && isTaskPlanningEditable(task)) {

                        setAdjustSheetTaskId(taskId)

                      }

                    }

                  : undefined

              }

              onReturnToAtencion={

                isEditingMode

                  ? (taskId) => setReturnDialogTaskId(taskId)

                  : undefined

              }

              isTaskReturnable={

                isEditingMode ? canReturnPlanningTaskToAtencion : undefined

              }

              onMoveTaskOrder={

                isEditingMode ? handleMoveTaskOrder : undefined

              }

              onMoveTaskToPosition={

                isEditingMode ? handleMoveTaskToPosition : undefined

              }

              onTravelMinutesChange={

                isEditingMode ? handleTravelMinutesChange : undefined

              }

              isTaskEditable={isEditingMode ? isTaskPlanningEditable : undefined}

              activeCrewFilterName={activeCrewFilterName}

              className="min-h-0 min-w-0 flex-1 lg:h-full"

            />

            {listTasks.length > 0 ? (
              <div className="flex w-full shrink-0 flex-col gap-2 lg:w-56">
                {planningDayConfig ? (
                  <PlanningDayConfigPanel
                    config={planningDayConfig.config}
                    crewName={planningDayConfig.crew.name}
                    readOnly={!isEditingMode}
                    onChange={(next) => {
                      const override = {
                        useHabitual: next.useHabitual,
                        operationalBaseName: next.operationalBaseName,
                        startTime: next.startTime,
                        availableMinutes: next.availableMinutes,
                      }
                      const validation =
                        validatePlanningDayOperationalOverride(override)
                      if (!validation.ok) {
                        setDispatchError(validation.message)
                        return
                      }
                      writePlanningDayOperationalOverride(
                        date,
                        planningDayConfig.crew.id,
                        override
                      )
                      setDayConfigRevision((value) => value + 1)
                    }}
                  />
                ) : null}
                <PlanningJourneySummaryPanel
                  summary={journeySummary}
                />
              </div>
            ) : null}

          </div>

        </div>

      </div>



      <PlanningTaskAdjustSheet

        task={adjustTask}

        allTasks={filteredTasks.filter(isTaskPlanningEditable)}

        open={adjustSheetTaskId != null}

        onOpenChange={(open) => {

          if (!open) {

            setAdjustSheetTaskId(null)

          }

        }}

      />

      <PlanningReturnToAtencionDialog
        open={returnDialogTaskId != null}
        onOpenChange={(open) => {
          if (!open && !isReturningToAtencion) {
            setReturnDialogTaskId(null)
          }
        }}
        task={returnDialogTask}
        isSubmitting={isReturningToAtencion}
        onConfirm={handleReturnToAtencion}
      />

      <PlanningPrintMaterialsDialog

        open={printMaterialsOpen}

        onOpenChange={setPrintMaterialsOpen}

        planningDate={date}

        tasks={filteredTasks}

        crews={activeCrews}

        initialCrewId={crewFilterId}

      />

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


