/**
 * Builds the unified CUADRILLAS Read Model from production + timeline builders.
 */

import { buildCrewProductionReadModel } from "@/lib/analysis/crew-production/builder"
import {
  crewProductionStatusLabel,
  resolveInterventionResult,
} from "@/lib/analysis/crew-production/narrative"
import {
  isCancelledOt,
  isFinishedOt,
  isPendingOt,
  isRescheduledOt,
  taskDurationMinutes,
} from "@/lib/analysis/crew-production/ot-helpers"
import type { CrewProductionSourceTask } from "@/lib/analysis/crew-production/types"
import { resolveCrewsPeriodRange } from "@/lib/analysis/crews/period"
import type {
  CrewsDossier,
  CrewsQualityMetric,
  CrewsRankingRow,
  CrewsReadModel,
  CrewsTrendBucket,
  CrewsWorkOrderRow,
} from "@/lib/analysis/crews/types"
import type { CrewsSourceTask } from "@/lib/analysis/crews/source-mappers"
import {
  toProductionCrews,
  toProductionTasks,
} from "@/lib/analysis/crews/source-mappers"
import { isBusinessIncidentReason } from "@/lib/analysis/planning-timeline/business-incidents"
import { buildPlanningTimelineReadModel } from "@/lib/analysis/planning-timeline/builder"
import type { PlanningTimelineSourceCrew } from "@/lib/analysis/planning-timeline/types"
import type { ExecutiveBrief } from "@/lib/executive/types"
import {
  buildCrewLookupIndexes,
  resolveCrewIdFromIndexes,
} from "@/lib/analysis/queries/lookup-indexes"

const UNASSIGNED = "__unassigned__"

function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

function toDateOnly(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function inRange(dueDate: string, from: string, to: string): boolean {
  return dueDate >= from && dueDate <= to
}

function metricsFromTasks(tasks: CrewsSourceTask[]) {
  const finishedTasks = tasks.filter((task) => isFinishedOt(task.status))
  const pending = tasks.filter((task) => isPendingOt(task.status)).length
  const cancelled = tasks.filter((task) => isCancelledOt(task.status)).length
  const rescheduled = tasks.filter((task) =>
    isRescheduledOt(task as unknown as CrewProductionSourceTask)
  ).length
  const finished = finishedTasks.length
  const assigned = finished + pending + cancelled
  const finishedMinutes = finishedTasks.reduce(
    (sum, task) => sum + taskDurationMinutes(task as unknown as CrewProductionSourceTask),
    0
  )
  const avgMinutes = finished > 0 ? finishedMinutes / finished : 0
  const productivity =
    assigned > 0 ? Math.round((finished / assigned) * 100) : 0

  return {
    assignedOt: assigned,
    finishedOt: finished,
    pendingOt: pending,
    cancelledOt: cancelled,
    rescheduledOt: rescheduled,
    compliance: productivity,
    avgMinutesPerOt: finished > 0 ? Math.round(avgMinutes) : 0,
    hoursWorked:
      finishedMinutes > 0
        ? Math.round((finishedMinutes / 60) * 10) / 10
        : 0,
    productivity,
  }
}

function buildQuality(tasks: CrewsSourceTask[]): CrewsQualityMetric[] {
  const total = tasks.length
  const pct = (count: number) =>
    total > 0 ? Math.round((count / total) * 100) : 0

  const clienteAusente = tasks.filter(
    (task) => task.incidentReason?.trim() === "cliente-ausente"
  ).length
  const material = tasks.filter(
    (task) => task.incidentReason?.trim() === "material-insuficiente"
  ).length
  const sinAcceso = tasks.filter(
    (task) => task.incidentReason?.trim() === "acceso-denegado"
  ).length
  const rechazos = tasks.filter(
    (task) => task.incidentReason?.trim() === "cliente-rechazo"
  ).length
  const incidencias = tasks.filter(
    (task) =>
      task.status === "incidencia" ||
      isBusinessIncidentReason(task.incidentReason)
  ).length

  return [
    {
      id: "cliente-ausente",
      label: "Cliente ausente",
      count: clienteAusente,
      percentage: pct(clienteAusente),
    },
    {
      id: "material-faltante",
      label: "Material faltante",
      count: material,
      percentage: pct(material),
    },
    {
      id: "sin-acceso",
      label: "Sin acceso",
      count: sinAcceso,
      percentage: pct(sinAcceso),
    },
    {
      id: "incidencias",
      label: "Incidencias",
      count: incidencias,
      percentage: pct(incidencias),
    },
    {
      id: "rechazos",
      label: "Rechazos",
      count: rechazos,
      percentage: pct(rechazos),
    },
  ]
}

function buildWorkOrders(tasks: CrewsSourceTask[]): CrewsWorkOrderRow[] {
  return [...tasks]
    .sort((left, right) => {
      const byDate = left.dueDate.localeCompare(right.dueDate)
      if (byDate !== 0) return byDate
      return (left.scheduledTime || left.title).localeCompare(
        right.scheduledTime || right.title,
        "es"
      )
    })
    .map((task, index, list) => {
      const travelRaw = task.taskMetadata?.travel_from_previous_minutes
      const travelMinutes =
        typeof travelRaw === "number" && Number.isFinite(travelRaw)
          ? travelRaw
          : typeof travelRaw === "string" && travelRaw.trim()
            ? Number(travelRaw)
            : null
      const previous = index > 0 ? list[index - 1] : null
      const sameDay = previous != null && previous.dueDate === task.dueDate
      const fromLabel = sameDay
        ? previous.customerName?.trim() ||
          previous.locality?.trim() ||
          previous.serviceAddress?.trim() ||
          "Anterior"
        : null

      return {
        taskId: task.id,
        customerName: task.customerName?.trim() || "Cliente no indicado",
        status: task.status,
        statusLabel: crewProductionStatusLabel(task.status),
        result: resolveInterventionResult(task.status),
        durationMinutes: taskDurationMinutes(
          task as unknown as CrewProductionSourceTask
        ),
        locality: task.locality?.trim() || "—",
        serviceType: task.serviceType?.trim() || task.title.trim() || "—",
        zone: task.locality?.trim() || "—",
        technology: task.serviceType?.trim() || "—",
        customerId: task.customerId?.trim() || null,
        dueDate: task.dueDate,
        scheduledTime: task.scheduledTime?.trim() || null,
        travelFromPreviousMinutes:
          sameDay && travelMinutes != null && Number.isFinite(travelMinutes)
            ? travelMinutes
            : null,
        travelFromLabel: fromLabel,
      }
    })
}

function buildTrends(
  tasks: CrewsSourceTask[],
  focusDate: string
): CrewsTrendBucket[] {
  const focus = parseLocalDate(focusDate)
  const today = toDateOnly(focus)

  const weekStart = new Date(focus)
  const day = weekStart.getDay()
  const diff = day === 0 ? -6 : 1 - day
  weekStart.setDate(weekStart.getDate() + diff)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  const weekFrom = toDateOnly(weekStart)
  const weekTo = toDateOnly(weekEnd)

  const monthFrom = toDateOnly(
    new Date(focus.getFullYear(), focus.getMonth(), 1, 12)
  )
  const monthTo = toDateOnly(
    new Date(focus.getFullYear(), focus.getMonth() + 1, 0, 12)
  )

  const buckets: Array<{
    id: CrewsTrendBucket["id"]
    label: string
    from: string
    to: string
  }> = [
    { id: "today", label: "Hoy", from: today, to: today },
    { id: "week", label: "Semana", from: weekFrom, to: weekTo },
    { id: "month", label: "Mes", from: monthFrom, to: monthTo },
  ]

  return buckets.map((bucket) => {
    const scoped = tasks.filter((task) =>
      inRange(task.dueDate, bucket.from, bucket.to)
    )
    const metrics = metricsFromTasks(scoped)
    return {
      id: bucket.id,
      label: bucket.label,
      finishedOt: metrics.finishedOt,
      assignedOt: metrics.assignedOt,
      pendingOt: metrics.pendingOt,
      productivity: metrics.productivity,
      avgMinutesPerOt: metrics.avgMinutesPerOt,
    }
  })
}

function groupTasksByCrew(
  tasks: CrewsSourceTask[],
  crews: PlanningTimelineSourceCrew[]
): Map<string, CrewsSourceTask[]> {
  const indexes = buildCrewLookupIndexes(
    crews.map((crew) => ({ id: crew.id, name: crew.name }))
  )
  const groups = new Map<string, CrewsSourceTask[]>()

  for (const task of tasks) {
    const crewId =
      resolveCrewIdFromIndexes(
        { crewId: task.crewId ?? undefined, crew: task.crew },
        indexes
      ) ?? UNASSIGNED
    const list = groups.get(crewId) ?? []
    list.push(task)
    groups.set(crewId, list)
  }

  return groups
}

export type BuildCrewsReadModelInput = {
  period: ReturnType<typeof resolveCrewsPeriodRange>
  executiveBrief: ExecutiveBrief
  crews: PlanningTimelineSourceCrew[]
  tasks: CrewsSourceTask[]
  now?: number
}

export function buildCrewsReadModel(
  input: BuildCrewsReadModelInput
): CrewsReadModel {
  const now = input.now ?? Date.now()
  const productionCrews = toProductionCrews(input.crews)
  const productionTasks = toProductionTasks(input.tasks)

  const production = buildCrewProductionReadModel({
    date: input.period.focusDate,
    executiveBrief: input.executiveBrief,
    crews: productionCrews,
    tasks: productionTasks,
    now,
  })

  const groups = groupTasksByCrew(input.tasks, input.crews)
  const ranking: CrewsRankingRow[] = production.ranking.map((row) => {
    const tasks = groups.get(row.crewId) ?? []
    const metrics = metricsFromTasks(tasks)
    return {
      crewId: row.crewId,
      crewName: row.crewName,
      status: row.status,
      statusLabel: row.statusLabel,
      memberCount: row.memberCount,
      assignedOt: metrics.assignedOt,
      finishedOt: metrics.finishedOt,
      compliance: metrics.compliance,
      avgMinutesPerOt: metrics.avgMinutesPerOt,
      productivity: metrics.productivity,
    }
  })

  const dossiersByCrewId: Record<string, CrewsDossier> = {}

  for (const crew of input.crews) {
    const tasks = groups.get(crew.id) ?? []
    const focusTasks = tasks.filter(
      (task) => task.dueDate === input.period.focusDate
    )
    const timelineTasks =
      focusTasks.length > 0 ? focusTasks : tasks.slice(0, 40)

    const timeline = buildPlanningTimelineReadModel({
      date: input.period.focusDate,
      executiveBrief: input.executiveBrief,
      crew,
      tasks: timelineTasks,
      now,
    })

    const detail = production.detailsByCrewId[crew.id]
    const productivity = metricsFromTasks(tasks)

    dossiersByCrewId[crew.id] = {
      crewId: crew.id,
      crewName: crew.name,
      narrative:
        detail?.narrative ??
        `${crew.name} no registró actividad en el período.`,
      productivity: {
        assignedOt: productivity.assignedOt,
        finishedOt: productivity.finishedOt,
        pendingOt: productivity.pendingOt,
        cancelledOt: productivity.cancelledOt,
        rescheduledOt: productivity.rescheduledOt,
        compliance: productivity.compliance,
        avgMinutesPerOt: productivity.avgMinutesPerOt,
        hoursWorked: productivity.hoursWorked,
      },
      quality: buildQuality(tasks),
      timeline,
      workOrders: buildWorkOrders(tasks),
      trends: buildTrends(tasks, input.period.focusDate),
      gpsCoverage: {
        reserved: true,
        title: "Cobertura GPS",
        message:
          "Próximamente: recorrido, kilómetros, tiempos y mapa de la jornada.",
      },
    }
  }

  return {
    period: {
      preset: input.period.preset,
      dateFrom: input.period.dateFrom,
      dateTo: input.period.dateTo,
      focusDate: input.period.focusDate,
    },
    builtAt: now,
    production,
    ranking,
    dossiersByCrewId,
  }
}
