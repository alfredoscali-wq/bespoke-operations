/**
 * PlanningReadBuilder — builds a complete jornada PlanningReadModel.
 * Uses existing planning helpers; no business-logic changes.
 */

import { isCrewAssignable } from "@/lib/crews/status-workflow"
import { getCrewAvailability } from "@/lib/crews/availability"
import { buildCrewPlanningSummary } from "@/lib/engines/planning/services/SummaryService"
import {
  applyDayOperationalBaseToCrew,
  readPlanningDayOperationalOverride,
  resolvePlanningDayOperationalConfig,
} from "@/lib/planificacion/planning-day-config"
import {
  filterConfirmedDispatchTasksForPlanning,
  filterProgrammedTasksForPlanningDate,
} from "@/lib/planificacion/planning-dispatch"
import {
  filterObraPlanningTasksForDate,
  filterPlanningOperationalViewTasks,
  isJourneyFullyPlanned,
  resolveCrewPlanningButtonVisibility,
  type CrewPlanningButtonVisibility,
} from "@/lib/planificacion/planning-crew-state"
import { listPendingClosureTasksForPlanningDate } from "@/lib/planificacion/planning-pending-closure"
import { listOrderedTasksForCrewJourney } from "@/lib/planificacion/planning-travel"
import {
  buildPlanningCrewSummaries,
  filterPlanningTasksByCrewFilter,
} from "@/lib/planificacion/planning-utils"
import {
  buildPlanningObraActiveRows,
  computePlanningObrasKpis,
  computePlanningOperativeKpis,
} from "@/lib/planificacion/planning-obras-lane"
import { isWorkOrderTask } from "@/lib/tasks/work-order"
import {
  countOperationallyOverdueTasks,
  filterOperationallyOverdueTasks,
} from "@/lib/tasks/operational-overdue"
import { sortTasksByDispatchRoute } from "@/lib/tasks/dispatch-order"
import type {
  PlanningObraRead,
  PlanningReadBuilderInput,
  PlanningReadModel,
} from "@/lib/planning/read-model/types"

function deriveObrasFromTasks(
  tasks: PlanningReadBuilderInput["tasks"]
): PlanningObraRead[] {
  const byId = new Map<string, PlanningObraRead>()

  for (const task of tasks) {
    const id = task.projectId?.trim()
    if (!id || byId.has(id)) continue

    byId.set(id, {
      id,
      code: task.projectCode?.trim() || id,
      name: task.projectName?.trim() || task.projectCode?.trim() || id,
    })
  }

  return [...byId.values()].sort((left, right) =>
    left.name.localeCompare(right.name, "es")
  )
}

/**
 * Builds the Planning read model for one jornada view state.
 * Functionally matches the prior in-module derivation.
 */
export function buildPlanningReadModel(
  input: PlanningReadBuilderInput,
  now: number = Date.now()
): PlanningReadModel {
  const {
    date,
    crewFilterId,
    overdueFilterActive,
    tasks,
    crews,
    employees,
    activeIncidents,
    activeIncidentsCount,
  } = input

  const sourceTasks = [...tasks]
  const sourceCrews = [...crews]
  const sourceEmployees = [...employees]

  const activeCrews = sourceCrews.filter(isCrewAssignable)
  const workOrderTasks = sourceTasks.filter(isWorkOrderTask)

  const isConfirmedMode = isJourneyFullyPlanned(
    sourceTasks,
    date,
    activeCrews
  )
  const dispatchMode = isConfirmedMode ? "confirmed" : "editing"

  const overdueCount = countOperationallyOverdueTasks(workOrderTasks)

  const filteredTasks = overdueFilterActive
    ? filterOperationallyOverdueTasks(workOrderTasks)
    : isConfirmedMode
      ? filterConfirmedDispatchTasksForPlanning(sourceTasks, { date })
      : filterPlanningOperationalViewTasks(sourceTasks, { date })

  const obrasActivas = overdueFilterActive
    ? []
    : filterObraPlanningTasksForDate(sourceTasks, { date })

  const sortedTasks = sortTasksByDispatchRoute(filteredTasks, sourceCrews)

  const listTasks = filterPlanningTasksByCrewFilter(
    filteredTasks,
    crewFilterId,
    activeCrews
  )

  const obrasForCrewFilter = filterPlanningTasksByCrewFilter(
    obrasActivas,
    crewFilterId,
    activeCrews
  )

  const selectedCrew = crewFilterId
    ? (activeCrews.find((crew) => crew.id === crewFilterId) ?? null)
    : null

  const dayConfig = selectedCrew
    ? {
        crew: selectedCrew,
        config: resolvePlanningDayOperationalConfig({
          crew: selectedCrew,
          override: readPlanningDayOperationalOverride(date, selectedCrew.id),
        }),
      }
    : null

  const capacityTasksForSelectedCrew = selectedCrew
    ? [...listTasks, ...obrasForCrewFilter]
    : listTasks

  const crewPlanningSummary =
    selectedCrew && dayConfig
      ? buildCrewPlanningSummary({
          tasks: capacityTasksForSelectedCrew,
          crew: applyDayOperationalBaseToCrew(selectedCrew, dayConfig.config),
          crews: activeCrews,
          availableMinutes: dayConfig.config.availableMinutes,
          planningDate: date,
        })
      : null

  /** Carga de cuadrilla = ruta + obras (capacidad); botones solo ven ruta. */
  const capacityTasks = [...filteredTasks, ...obrasActivas]
  const crewSummaries = buildPlanningCrewSummaries(
    capacityTasks,
    activeCrews,
    date
  )

  const crewPlanningButtonsById: Record<string, CrewPlanningButtonVisibility> =
    {}
  for (const summary of crewSummaries) {
    const buttons = resolveCrewPlanningButtonVisibility(
      sourceTasks,
      date,
      summary.crew
    )
    if (buttons) {
      crewPlanningButtonsById[summary.crew.id] = buttons
    }
  }

  const planningOrderScope = filterProgrammedTasksForPlanningDate(sourceTasks, {
    date,
  })

  const pendingClosure = listPendingClosureTasksForPlanningDate(
    sourceTasks,
    date,
    activeCrews
  )

  const orderedAgendaTasks = crewFilterId
    ? listOrderedTasksForCrewJourney(listTasks, crewFilterId, sourceCrews)
    : sortedTasks

  const operativeKpis = computePlanningOperativeKpis(
    filteredTasks,
    date,
    overdueCount
  )
  const obrasKpis = computePlanningObrasKpis(obrasActivas, date, activeCrews)

  const crewIdsInOrder = activeCrews.map((crew) => crew.id)
  const crewNamesById = Object.fromEntries(
    activeCrews.map((crew) => [crew.id, crew.name] as const)
  )

  const availability = activeCrews.map((crew) =>
    getCrewAvailability(crew, {
      availabilityRecords: [],
      getEmployee: (id) =>
        sourceEmployees.find((employee) => employee.id === id),
      referenceDate: date,
    })
  )

  return {
    builtAt: now,
    date,
    crewFilterId,
    overdueFilterActive,
    crews: activeCrews,
    employees: sourceEmployees,
    availability,
    obras: deriveObrasFromTasks(sourceTasks),
    tasks: {
      filtered: filteredTasks,
      sorted: sortedTasks,
      list: listTasks,
      planningOrderScope,
      pendingClosure,
      obrasActivas: obrasForCrewFilter,
      obrasActivasRows: buildPlanningObraActiveRows(
        obrasForCrewFilter,
        date,
        activeCrews
      ),
    },
    agenda: {
      crewId: crewFilterId,
      orderedTaskIds: orderedAgendaTasks.map((task) => task.id),
    },
    metrics: {
      overdueCount,
      isConfirmedMode,
      dispatchMode,
      crewSummaries,
      crewPlanningSummary,
      crewPlanningButtonsById,
      operativeKpis,
      obrasKpis,
    },
    incidents: {
      active: [...activeIncidents],
      activeCount: activeIncidentsCount,
    },
    dayConfig,
    crewIdsInOrder,
    crewNamesById,
    activeCrewFilterName: crewFilterId
      ? crewNamesById[crewFilterId]?.trim() || null
      : null,
  }
}
