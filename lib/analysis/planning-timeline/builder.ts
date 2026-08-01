/**
 * PlanningTimelineReadBuilder — chronological operational story for one crew.
 * Uses Planning travel helpers + OT classification. No Activity Engine.
 */

import {
  isBusinessIncidentReason,
  businessIncidentTitle,
} from "@/lib/analysis/planning-timeline/business-incidents"
import type {
  PlanningTimelineCard,
  PlanningTimelineReadModel,
  PlanningTimelineSourceCrew,
  PlanningTimelineSourceTask,
  PlanningTimelineSummary,
  PlanningTimelineWorkOrderOutcome,
} from "@/lib/analysis/planning-timeline/types"
import type { ExecutiveBrief } from "@/lib/executive/types"
import { planningRepository } from "@/lib/engines/planning/repositories/PlanningRepository"
import {
  PLANNING_BASE_LABEL,
  resolveReturnToBaseMinutes,
  resolveTravelFromPreviousMinutes,
} from "@/lib/planificacion/planning-travel"
import { parseEstimatedDurationMinutes } from "@/lib/planificacion/planning-duration"
import { resolveTaskRouteOrder } from "@/lib/tasks/dispatch-order"

const FINISHED = new Set(["finalizada", "cerrada"])
const PENDING = new Set([
  "asignada",
  "programada",
  "en-curso",
  "vencida",
  "incidencia",
  "pendiente-cierre",
  "en-aprobacion",
])

function isFinished(status: string): boolean {
  return FINISHED.has(status)
}

function isPending(status: string): boolean {
  return PENDING.has(status)
}

function isCancelled(status: string): boolean {
  return status === "cancelada"
}

function isRescheduled(task: PlanningTimelineSourceTask): boolean {
  const meta = task.taskMetadata ?? {}
  return Boolean(
    meta.rescheduleReason || meta.rescheduledAt || meta.originalScheduledDate
  )
}

function durationMinutes(task: PlanningTimelineSourceTask): number {
  return parseEstimatedDurationMinutes(task.estimatedDuration ?? "")
}

function formatTimeLabel(value: string | null | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) return "—"
  // HH:MM or HH:MM:SS
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/)
  if (match) {
    return `${match[1].padStart(2, "0")}:${match[2]}`
  }
  return trimmed
}

function placeLabel(task: PlanningTimelineSourceTask): string {
  const customer = task.customerName?.trim()
  if (customer) return customer
  const address = task.serviceAddress?.trim()
  if (address) return address
  const locality = task.locality?.trim()
  if (locality) return locality
  return "Intervención"
}

function workTypeLabel(task: PlanningTimelineSourceTask): string {
  const service = task.serviceType?.trim()
  if (service) return service
  const title = task.title?.trim()
  if (title) return title
  return "Orden de trabajo"
}

function workResult(task: PlanningTimelineSourceTask): string {
  if (isFinished(task.status)) return "Completada"
  if (isCancelled(task.status)) return "Cancelada"
  if (task.status === "incidencia") return "Con incidencia"
  if (isRescheduled(task)) return "Reprogramada"
  if (task.status === "en-curso") return "En ejecución"
  if (
    task.status === "en-aprobacion" ||
    task.status === "pendiente-cierre"
  ) {
    return "En cierre"
  }
  return "Programada"
}

function workOutcome(
  task: PlanningTimelineSourceTask
): PlanningTimelineWorkOrderOutcome {
  if (isCancelled(task.status)) return "cancelled"
  if (isRescheduled(task)) return "rescheduled"
  if (task.status === "incidencia") return "incident"
  if (isFinished(task.status)) return "finished"
  return "pending"
}

function routeOrder(task: PlanningTimelineSourceTask): number | null {
  return resolveTaskRouteOrder({
    dispatchOrder: task.dispatchOrder,
    executionOrder: task.executionOrder,
    status: task.status as never,
  })
}

function sortTasks(
  tasks: PlanningTimelineSourceTask[]
): PlanningTimelineSourceTask[] {
  return [...tasks].sort((left, right) => {
    const leftOrder = routeOrder(left)
    const rightOrder = routeOrder(right)
    if (leftOrder != null && rightOrder != null && leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }
    if (leftOrder != null && rightOrder == null) return -1
    if (leftOrder == null && rightOrder != null) return 1

    const leftTime = left.scheduledTime?.trim() || ""
    const rightTime = right.scheduledTime?.trim() || ""
    if (leftTime && rightTime && leftTime !== rightTime) {
      return leftTime.localeCompare(rightTime)
    }
    if (leftTime && !rightTime) return -1
    if (!leftTime && rightTime) return 1

    return (left.title || "").localeCompare(right.title || "", "es")
  })
}

function baseLabel(crew: PlanningTimelineSourceCrew): string {
  const name = crew.operationalBaseName?.trim()
  return name || PLANNING_BASE_LABEL
}

function buildDayEndSummary(input: {
  finished: number
  rescheduled: number
  avgMinutes: number
  criticalIncidents: number
}): string {
  const parts: string[] = []
  parts.push(
    `La cuadrilla completó ${input.finished} OT.`
  )
  if (input.rescheduled > 0) {
    parts.push(
      `Reprogramó ${input.rescheduled}.`
    )
  } else {
    parts.push("Sin reprogramaciones.")
  }
  if (input.finished > 0 && input.avgMinutes > 0) {
    parts.push(`Tiempo promedio ${Math.round(input.avgMinutes)} minutos.`)
  }
  if (input.criticalIncidents === 0) {
    parts.push("Sin incidentes críticos.")
  } else {
    parts.push(
      `${input.criticalIncidents} incidente${input.criticalIncidents === 1 ? "" : "s"} de negocio.`
    )
  }
  return parts.join(" ")
}

export type BuildPlanningTimelineReadModelInput = {
  date: string
  executiveBrief: ExecutiveBrief
  crew: PlanningTimelineSourceCrew
  tasks: PlanningTimelineSourceTask[]
  now?: number
}

export function buildPlanningTimelineReadModel(
  input: BuildPlanningTimelineReadModelInput
): PlanningTimelineReadModel {
  const now = input.now ?? Date.now()
  const ordered = sortTasks(input.tasks)
  const cards: PlanningTimelineCard[] = []

  const finishedTasks = ordered.filter((task) => isFinished(task.status))
  const pendingTasks = ordered.filter((task) => isPending(task.status))
  const cancelled = ordered.filter((task) => isCancelled(task.status)).length
  const rescheduled = ordered.filter((task) => isRescheduled(task)).length
  const finished = finishedTasks.length
  const pending = pendingTasks.length
  const programmed = finished + pending + cancelled
  const finishedMinutes = finishedTasks.reduce(
    (sum, task) => sum + durationMinutes(task),
    0
  )
  const avgMinutes = finished > 0 ? finishedMinutes / finished : 0
  const productivity =
    programmed > 0 ? Math.round((finished / programmed) * 100) : 0

  let distanceMeters = 0
  let travelMinutes = 0
  for (const task of ordered) {
    const travel = planningRepository.readTravelFromPrevious(task.taskMetadata)
    const ret = planningRepository.readReturnToBase(task.taskMetadata)
    distanceMeters += (travel.distanceMeters ?? 0) + (ret.distanceMeters ?? 0)
  }
  travelMinutes = ordered.reduce(
    (sum, task) => sum + resolveTravelFromPreviousMinutes(task),
    0
  )
  travelMinutes += resolveReturnToBaseMinutes(ordered)

  const memberNames = input.crew.members
    .filter((member) => member.active)
    .map((member) => member.name.trim())
    .filter(Boolean)

  const startTime =
    formatTimeLabel(input.crew.habitualStartTime) !== "—"
      ? formatTimeLabel(input.crew.habitualStartTime)
      : ordered[0]
        ? formatTimeLabel(ordered[0].scheduledTime)
        : "—"

  cards.push({
    kind: "day-start",
    id: `day-start-${input.crew.id}`,
    sortKey: "0000",
    timeLabel: startTime,
    crewName: input.crew.name,
    memberNames,
    vehicleLabel: input.crew.vehicleLabel,
  })

  let sequence = 1
  for (let index = 0; index < ordered.length; index += 1) {
    const task = ordered[index]
    const pad = String(sequence).padStart(4, "0")
    const travelMinutesForTask = resolveTravelFromPreviousMinutes(task)

    if (travelMinutesForTask > 0) {
      const fromLabel =
        index === 0 ? baseLabel(input.crew) : placeLabel(ordered[index - 1])
      cards.push({
        kind: "travel",
        id: `travel-${task.id}`,
        sortKey: `${pad}-a`,
        fromLabel,
        toLabel: placeLabel(task),
        minutes: travelMinutesForTask,
      })
    }

    cards.push({
      kind: "work-order",
      id: `wo-${task.id}`,
      sortKey: `${pad}-b`,
      timeLabel: formatTimeLabel(task.scheduledTime),
      customerName: task.customerName?.trim() || "Cliente no indicado",
      workType: workTypeLabel(task),
      result: workResult(task),
      outcome: workOutcome(task),
      durationMinutes: durationMinutes(task),
      taskId: task.id,
      customerId: task.customerId?.trim() || null,
    })

    if (isBusinessIncidentReason(task.incidentReason)) {
      cards.push({
        kind: "incident",
        id: `incident-${task.id}`,
        sortKey: `${pad}-c`,
        timeLabel: formatTimeLabel(task.scheduledTime),
        title: businessIncidentTitle(task.incidentReason) ?? "Incidente",
        detail: task.incidentObservation?.trim() || null,
        taskId: task.id,
      })
    } else if (isRescheduled(task)) {
      const reason =
        typeof task.taskMetadata.rescheduleReason === "string"
          ? task.taskMetadata.rescheduleReason.trim()
          : ""
      cards.push({
        kind: "incident",
        id: `reschedule-${task.id}`,
        sortKey: `${pad}-c`,
        timeLabel: formatTimeLabel(task.scheduledTime),
        title: "Reprogramación",
        detail: reason || null,
        taskId: task.id,
      })
    }

    sequence += 1
  }

  if (ordered.length > 0) {
    const returnMinutes = resolveReturnToBaseMinutes(ordered)
    if (returnMinutes > 0) {
      const last = ordered[ordered.length - 1]
      cards.push({
        kind: "travel",
        id: `travel-return-${last.id}`,
        sortKey: "9998",
        fromLabel: placeLabel(last),
        toLabel: baseLabel(input.crew),
        minutes: returnMinutes,
      })
    }
  }

  const criticalIncidents = cards.filter((card) => card.kind === "incident").length

  cards.push({
    kind: "day-end",
    id: `day-end-${input.crew.id}`,
    sortKey: "9999",
    summary: buildDayEndSummary({
      finished,
      rescheduled,
      avgMinutes,
      criticalIncidents,
    }),
  })

  const summary: PlanningTimelineSummary = {
    finishedOt: finished,
    pendingOt: pending,
    avgMinutesPerOt: finished > 0 ? Math.round(avgMinutes) : 0,
    productivity,
    distanceKm:
      distanceMeters > 0
        ? Number((distanceMeters / 1000).toFixed(1))
        : null,
    travelMinutes,
    hoursWorked:
      finishedMinutes > 0
        ? Math.round((finishedMinutes / 60) * 10) / 10
        : 0,
  }

  return {
    date: input.date,
    builtAt: now,
    crewId: input.crew.id,
    crewName: input.crew.name,
    executiveBrief: input.executiveBrief,
    summary,
    cards,
  }
}
