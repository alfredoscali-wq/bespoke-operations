/**
 * CrewProductionReadBuilder — builds the full screen Read Model.
 */

import type { ExecutiveBrief } from "@/lib/executive/types"
import {
  buildCrewProductionNarrative,
  crewProductionStatusLabel,
  interventionCustomerName,
  rankByProductivity,
  resolveInterventionResult,
} from "@/lib/analysis/crew-production/narrative"
import {
  isCancelledOt,
  isFinishedOt,
  isPendingOt,
  isRescheduledOt,
  taskDurationMinutes,
  taskTravelDistanceMeters,
  workOrderLabel,
} from "@/lib/analysis/crew-production/ot-helpers"
import type {
  CrewProductionDetail,
  CrewProductionIndicator,
  CrewProductionIntervention,
  CrewProductionKpis,
  CrewProductionRankingRow,
  CrewProductionReadModel,
  CrewProductionSourceCrew,
  CrewProductionSourceTask,
  CrewProductionStatus,
} from "@/lib/analysis/crew-production/types"
import {
  buildCrewLookupIndexes,
  resolveCrewIdFromIndexes,
} from "@/lib/analysis/queries/lookup-indexes"

const UNASSIGNED = "__unassigned__"

function mapCrewStatus(status: string): CrewProductionStatus {
  if (status === "activa" || status === "inactiva" || status === "en-campo") {
    return status
  }
  return "sin-datos"
}

function crewStatusLabel(status: CrewProductionStatus): string {
  if (status === "activa") return "Activa"
  if (status === "inactiva") return "Inactiva"
  if (status === "en-campo") return "En campo"
  return "Sin datos"
}

function groupTasksByCrew(
  tasks: CrewProductionSourceTask[],
  crews: CrewProductionSourceCrew[]
): Map<string, CrewProductionSourceTask[]> {
  const indexes = buildCrewLookupIndexes(
    crews.map((crew) => ({ id: crew.id, name: crew.name }))
  )
  const groups = new Map<string, CrewProductionSourceTask[]>()

  for (const task of tasks) {
    const crewId =
      resolveCrewIdFromIndexes(
        { crewId: task.crewId, crew: task.crew },
        indexes
      ) ?? UNASSIGNED
    const list = groups.get(crewId) ?? []
    list.push(task)
    groups.set(crewId, list)
  }

  return groups
}

function buildJourney(
  tasks: CrewProductionSourceTask[]
): CrewProductionIntervention[] {
  return [...tasks]
    .sort((left, right) => left.code.localeCompare(right.code, "es"))
    .map((task) => ({
      taskId: task.id,
      workOrderLabel: workOrderLabel(task),
      result: resolveInterventionResult(task.status),
      durationMinutes: taskDurationMinutes(task),
      customerName: interventionCustomerName(task),
      status: task.status,
      statusLabel: crewProductionStatusLabel(task.status),
    }))
}

function buildIndicators(input: {
  finished: number
  rescheduled: number
  cancelled: number
  avgMinutes: number
  distanceMeters: number
  customers: number
}): CrewProductionIndicator[] {
  const indicators: CrewProductionIndicator[] = [
    { id: "finished", label: "OT finalizadas", value: input.finished },
    { id: "rescheduled", label: "Reprogramadas", value: input.rescheduled },
    { id: "cancelled", label: "Canceladas", value: input.cancelled },
    {
      id: "avgMinutes",
      label: "Tiempo promedio",
      value: input.avgMinutes > 0 ? Math.round(input.avgMinutes) : 0,
      unit: "min",
    },
  ]

  if (input.distanceMeters > 0) {
    indicators.push({
      id: "distance",
      label: "Distancia recorrida",
      value: Number((input.distanceMeters / 1000).toFixed(1)),
      unit: "km",
    })
  }

  indicators.push({
    id: "customers",
    label: "Clientes atendidos",
    value: input.customers,
  })

  return indicators
}

export type BuildCrewProductionReadModelInput = {
  date: string
  executiveBrief: ExecutiveBrief
  crews: CrewProductionSourceCrew[]
  tasks: CrewProductionSourceTask[]
  now?: number
}

export function buildCrewProductionReadModel(
  input: BuildCrewProductionReadModelInput
): CrewProductionReadModel {
  const now = input.now ?? Date.now()
  const groups = groupTasksByCrew(input.tasks, input.crews)
  const ranking: CrewProductionRankingRow[] = []
  const detailsByCrewId: Record<string, CrewProductionDetail> = {}

  let totalFinished = 0
  let totalPending = 0
  let totalFinishedMinutes = 0
  let productivitySum = 0
  let productivityCount = 0
  let activeCrews = 0

  for (const crew of input.crews) {
    const tasks = groups.get(crew.id) ?? []
    const finishedTasks = tasks.filter((task) => isFinishedOt(task.status))
    const pendingTasks = tasks.filter((task) => isPendingOt(task.status))
    const cancelled = tasks.filter((task) => isCancelledOt(task.status)).length
    const rescheduled = tasks.filter((task) => isRescheduledOt(task)).length
    const finished = finishedTasks.length
    const pending = pendingTasks.length
    const programmed = finished + pending + cancelled
    const finishedMinutes = finishedTasks.reduce(
      (sum, task) => sum + taskDurationMinutes(task),
      0
    )
    const avgMinutes =
      finished > 0 ? finishedMinutes / finished : 0
    const productivity =
      programmed > 0 ? Math.round((finished / programmed) * 100) : 0
    const distanceMeters = tasks.reduce(
      (sum, task) => sum + taskTravelDistanceMeters(task),
      0
    )
    const customers = new Set(
      tasks
        .map((task) => interventionCustomerName(task))
        .filter((name) => name !== "Cliente no indicado")
    ).size

    const status = mapCrewStatus(crew.status)
    if (status === "activa" || status === "en-campo" || tasks.length > 0) {
      activeCrews += 1
    }

    totalFinished += finished
    totalPending += pending
    totalFinishedMinutes += finishedMinutes
    if (programmed > 0) {
      productivitySum += productivity
      productivityCount += 1
    }

    ranking.push({
      crewId: crew.id,
      crewName: crew.name,
      memberCount: crew.memberCount,
      status,
      statusLabel: crewStatusLabel(status),
      finishedOt: finished,
      pendingOt: pending,
      avgMinutesPerOt: Math.round(avgMinutes),
      productivity,
    })

    detailsByCrewId[crew.id] = {
      crewId: crew.id,
      crewName: crew.name,
      narrative: buildCrewProductionNarrative({
        crewName: crew.name,
        finished,
        programmed,
        cancelled,
        avgMinutes,
      }),
      indicators: buildIndicators({
        finished,
        rescheduled,
        cancelled,
        avgMinutes,
        distanceMeters,
        customers,
      }),
      journey: buildJourney(tasks),
    }
  }

  const kpis: CrewProductionKpis = {
    activeCrews,
    finishedOt: totalFinished,
    pendingOt: totalPending,
    hoursWorked:
      totalFinishedMinutes > 0
        ? Math.round((totalFinishedMinutes / 60) * 10) / 10
        : 0,
    avgProductivity:
      productivityCount > 0
        ? Math.round(productivitySum / productivityCount)
        : 0,
    avgMinutesPerOt:
      totalFinished > 0
        ? Math.round(totalFinishedMinutes / totalFinished)
        : 0,
  }

  return {
    date: input.date,
    builtAt: now,
    executiveBrief: input.executiveBrief,
    kpis,
    ranking: rankByProductivity(ranking),
    detailsByCrewId,
  }
}
