import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import { parseCambioDomicilioFromTask, isCambioDomicilioTask } from "@/lib/tasks/cambio-domicilio"
import { formatScheduledTimeForInput } from "@/lib/tasks/scheduling"
import {
  getWorkOrderServiceTypeLabel,
  isWorkOrderTask,
  type WorkOrderShift,
} from "@/lib/tasks/work-order"
import { hasCoordinates } from "@/lib/gps/coordinates"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"

export type PlanningFilters = {
  date: string
}

export type PlanningCrewSummary = {
  crew: Crew
  taskCount: number
  estimatedMinutes: number
  loadLevel: PlanningCrewLoadLevel
}

export type PlanningCrewLoadLevel = "ok" | "warning" | "overload"

export type PlanningTaskCoordinates = {
  latitude: number
  longitude: number
}

export type PlanningKpis = {
  programmedCount: number
  activeCrewsCount: number
  estimatedHours: number
  withoutCrewCount: number
  withoutGpsCount: number
}

export type PlanningAlerts = {
  withoutGps: number
  withoutCrew: number
  withoutDuration: number
  overloadedCrews: { crewName: string; estimatedHours: number }[]
}

const CREW_LOAD_OK_MAX_MINUTES = 6 * 60
const CREW_LOAD_WARNING_MAX_MINUTES = 8 * 60

export function resolveTaskShift(
  task: Pick<Task, "taskMetadata" | "scheduledTime">
): WorkOrderShift | null {
  const metadataShift = task.taskMetadata?.shift
  if (metadataShift === "manana" || metadataShift === "tarde") {
    return metadataShift
  }

  const scheduledTime = formatScheduledTimeForInput(task.scheduledTime)
  if (scheduledTime.startsWith("14")) {
    return "tarde"
  }
  if (scheduledTime.startsWith("08")) {
    return "manana"
  }

  return null
}

export function resolveTaskPlanningCoordinates(
  task: Pick<Task, "latitude" | "longitude" | "serviceType" | "taskMetadata">
): PlanningTaskCoordinates | null {
  if (isCambioDomicilioTask(task)) {
    const details = parseCambioDomicilioFromTask(task as Task)
    if (
      hasCoordinates(details.new.latitude, details.new.longitude) &&
      details.new.latitude != null &&
      details.new.longitude != null
    ) {
      return {
        latitude: details.new.latitude,
        longitude: details.new.longitude,
      }
    }

    return null
  }

  if (
    hasCoordinates(task.latitude, task.longitude) &&
    task.latitude != null &&
    task.longitude != null
  ) {
    return { latitude: task.latitude, longitude: task.longitude }
  }

  return null
}

export function parseEstimatedDurationMinutes(value: string): number {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) {
    return 0
  }

  const minutesMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*min/)
  if (minutesMatch) {
    return Math.round(Number.parseFloat(minutesMatch[1].replace(",", ".")))
  }

  const hoursMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*h(?:ora|oras)?/)
  if (hoursMatch) {
    return Math.round(Number.parseFloat(hoursMatch[1].replace(",", ".")) * 60)
  }

  const daysMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*d(?:ia|ías|ias)?/)
  if (daysMatch) {
    return Math.round(Number.parseFloat(daysMatch[1].replace(",", ".")) * 8 * 60)
  }

  const numeric = Number.parseInt(trimmed, 10)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0
}

export function formatPlanningEstimatedHours(totalMinutes: number): string {
  if (totalMinutes <= 0) {
    return "0 h"
  }

  const hours = totalMinutes / 60
  if (hours < 10) {
    return `${hours.toFixed(1).replace(".", ",")} h`
  }

  return `${Math.round(hours)} h`
}

export function taskHasEstimatedDuration(
  task: Pick<Task, "estimatedDuration">
): boolean {
  return parseEstimatedDurationMinutes(task.estimatedDuration) > 0
}

export function resolveCrewLoadLevel(
  estimatedMinutes: number
): PlanningCrewLoadLevel {
  if (estimatedMinutes <= CREW_LOAD_OK_MAX_MINUTES) {
    return "ok"
  }

  if (estimatedMinutes <= CREW_LOAD_WARNING_MAX_MINUTES) {
    return "warning"
  }

  return "overload"
}

export function resolveCrewLoadLabel(level: PlanningCrewLoadLevel): string {
  switch (level) {
    case "ok":
      return "🟢 Hasta 6 horas"
    case "warning":
      return "🟡 Entre 6 y 8 horas"
    case "overload":
      return "🔴 Más de 8 horas"
  }
}

export function computePlanningAlerts(
  tasks: Task[],
  crewSummaries: PlanningCrewSummary[]
): PlanningAlerts {
  return {
    withoutGps: tasks.filter(
      (task) => resolveTaskPlanningCoordinates(task) == null
    ).length,
    withoutCrew: tasks.filter((task) => !taskHasSuggestedCrew(task)).length,
    withoutDuration: tasks.filter((task) => !taskHasEstimatedDuration(task))
      .length,
    overloadedCrews: crewSummaries
      .filter((summary) => summary.loadLevel === "overload")
      .map((summary) => ({
        crewName: summary.crew.name,
        estimatedHours: summary.estimatedMinutes / 60,
      })),
  }
}

export function taskHasSuggestedCrew(task: Pick<Task, "crewId" | "crew">): boolean {
  return Boolean(task.crewId?.trim() || task.crew?.trim())
}

export function filterProgrammedTasksForPlanning(
  tasks: Task[],
  filters: PlanningFilters
): Task[] {
  return tasks.filter((task) => {
    if (!isWorkOrderTask(task) || task.status !== "programada") {
      return false
    }

    if (task.dueDate !== filters.date) {
      return false
    }

    return true
  })
}

export function computePlanningKpis(
  tasks: Task[],
  activeCrews: Crew[]
): PlanningKpis {
  const totalMinutes = tasks.reduce(
    (sum, task) => sum + parseEstimatedDurationMinutes(task.estimatedDuration),
    0
  )

  return {
    programmedCount: tasks.length,
    activeCrewsCount: activeCrews.length,
    estimatedHours: totalMinutes / 60,
    withoutCrewCount: tasks.filter((task) => !taskHasSuggestedCrew(task)).length,
    withoutGpsCount: tasks.filter(
      (task) => resolveTaskPlanningCoordinates(task) == null
    ).length,
  }
}

export function buildPlanningCrewSummaries(
  tasks: Task[],
  activeCrews: Crew[]
): PlanningCrewSummary[] {
  return [...activeCrews]
    .sort((left, right) => left.name.localeCompare(right.name, "es"))
    .map((crew) => {
      const crewTasks = tasks.filter((task) => taskMatchesCrewId(task, crew))
      const estimatedMinutes = crewTasks.reduce(
        (sum, task) => sum + parseEstimatedDurationMinutes(task.estimatedDuration),
        0
      )

      return {
        crew,
        taskCount: crewTasks.length,
        estimatedMinutes,
        loadLevel: resolveCrewLoadLevel(estimatedMinutes),
      }
    })
}

export function resolvePlanningTaskShiftDisplayLabel(
  task: Pick<Task, "taskMetadata" | "scheduledTime">
): string {
  const shift = resolveTaskShift(task)
  if (shift === "manana") {
    return "🌞 Mañana"
  }
  if (shift === "tarde") {
    return "🌙 Tarde"
  }

  return "—"
}

export function resolvePlanningTaskLocality(task: Task): string {
  return task.locality?.trim() || "—"
}

export function resolvePlanningTaskServiceLabel(task: Task): string {
  return getWorkOrderServiceTypeLabel(task.serviceType) ?? task.title
}

export function resolvePlanningTaskClientLabel(task: Task): string {
  return (
    task.customerName?.trim() ||
    task.projectName?.trim() ||
    task.customerCompany?.trim() ||
    "Sin cliente"
  )
}

export function resolvePlanningTaskCrewLabel(task: Pick<Task, "crewId" | "crew">): string {
  return task.crew?.trim() || "Sin cuadrilla sugerida"
}

export function resolvePlanningMapBounds(
  coordinates: PlanningTaskCoordinates[]
): [[number, number], [number, number]] | null {
  if (coordinates.length === 0) {
    return null
  }

  let minLat = coordinates[0].latitude
  let maxLat = coordinates[0].latitude
  let minLng = coordinates[0].longitude
  let maxLng = coordinates[0].longitude

  for (const point of coordinates) {
    minLat = Math.min(minLat, point.latitude)
    maxLat = Math.max(maxLat, point.latitude)
    minLng = Math.min(minLng, point.longitude)
    maxLng = Math.max(maxLng, point.longitude)
  }

  const latPadding = Math.max((maxLat - minLat) * 0.12, 0.01)
  const lngPadding = Math.max((maxLng - minLng) * 0.12, 0.01)

  return [
    [minLat - latPadding, minLng - lngPadding],
    [maxLat + latPadding, maxLng + lngPadding],
  ]
}

/** Centro por defecto (Córdoba Capital) cuando no hay OT con GPS. */
export const PLANNING_MAP_DEFAULT_CENTER: PlanningTaskCoordinates = {
  latitude: -31.420083,
  longitude: -64.188776,
}

export const PLANNING_MAP_DEFAULT_ZOOM = 12
export const PLANNING_MAP_SINGLE_MARKER_ZOOM = 16
export const PLANNING_MAP_FIT_BOUNDS_PADDING: [number, number] = [60, 60]

export type PlanningMapViewConfig =
  | {
      type: "bounds"
      bounds: [[number, number], [number, number]]
    }
  | {
      type: "point"
      latitude: number
      longitude: number
      zoom: number
    }
  | {
      type: "default"
    }

export function resolvePlanningMapViewConfig(
  coordinates: PlanningTaskCoordinates[]
): PlanningMapViewConfig {
  if (coordinates.length > 1) {
    const bounds = resolvePlanningMapBounds(coordinates)
    if (bounds) {
      return { type: "bounds", bounds }
    }
  }

  if (coordinates.length === 1) {
    const point = coordinates[0]
    return {
      type: "point",
      latitude: point.latitude,
      longitude: point.longitude,
      zoom: PLANNING_MAP_SINGLE_MARKER_ZOOM,
    }
  }

  return { type: "default" }
}
