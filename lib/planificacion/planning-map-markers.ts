import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"
import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import { isTaskVencida } from "@/lib/tasks/vencida-status"
import type { PlanningTaskCoordinates } from "@/lib/planificacion/planning-utils"

export const PLANNING_PIN_COLOR_VENCIDA = "#dc2626"
export const PLANNING_PIN_COLOR_SELECTED = "#ea580c"
export const PLANNING_PIN_COLOR_NO_CREW = "#94a3b8"
export const PLANNING_PIN_COLOR_FILTERED_OUT = "#94a3b8"
export const PLANNING_PIN_FILTERED_OUT_OPACITY = 0.4
export const PLANNING_PIN_FILTERED_IN_Z_INDEX_BOOST = 100

/** Cuadrilla 1 azul, 2 amarillo, 3 verde, luego paleta extendida. */
export const PLANNING_CREW_PIN_COLORS = [
  "#2563eb",
  "#eab308",
  "#16a34a",
  "#9333ea",
  "#0891b2",
  "#db2777",
  "#4f46e5",
  "#f97316",
] as const

export type PlanningCrewLegendItem = {
  crewId: string
  label: string
  color: string
}

export function buildPlanningCrewColorIndex(
  crewIdsInOrder: string[]
): Map<string, number> {
  const map = new Map<string, number>()
  crewIdsInOrder.forEach((crewId, index) => {
    if (crewId.trim()) {
      map.set(crewId, index)
    }
  })
  return map
}

export function buildPlanningCrewLegendItems(
  crewIdsInOrder: string[],
  crewNamesById: Record<string, string>
): PlanningCrewLegendItem[] {
  return crewIdsInOrder.flatMap((crewId, index) => {
    const label = crewNamesById[crewId]?.trim()
    if (!label) {
      return []
    }

    return [
      {
        crewId,
        label,
        color:
          PLANNING_CREW_PIN_COLORS[index % PLANNING_CREW_PIN_COLORS.length],
      },
    ]
  })
}

export function resolvePlanningPinColor(
  task: Pick<Task, "id" | "status" | "crewId" | "taskMetadata">,
  highlightedTaskId: string | null,
  crewColorIndex: Map<string, number>
): string {
  if (isTaskVencida(task)) {
    return PLANNING_PIN_COLOR_VENCIDA
  }

  if (highlightedTaskId && task.id === highlightedTaskId) {
    return PLANNING_PIN_COLOR_SELECTED
  }

  const crewId = task.crewId?.trim()
  if (!crewId) {
    return PLANNING_PIN_COLOR_NO_CREW
  }

  const index = crewColorIndex.get(crewId)
  if (index === undefined) {
    return PLANNING_PIN_COLOR_NO_CREW
  }

  return PLANNING_CREW_PIN_COLORS[index % PLANNING_CREW_PIN_COLORS.length]
}

export type PlanningPinVisualState = {
  color: string
  opacity: number
  zIndexOffset: number
  highlighted: boolean
}

export function resolvePlanningPinVisualState(
  task: Pick<Task, "id" | "status" | "crewId" | "crew">,
  input: {
    highlightedTaskId: string | null
    crewColorIndex: Map<string, number>
    activeCrewFilterId: string | null
    crews: Pick<Crew, "id" | "name">[]
  }
): PlanningPinVisualState {
  const highlighted = isPlanningPinHighlighted(task.id, input.highlightedTaskId)
  const color = resolvePlanningPinColor(
    task,
    input.highlightedTaskId,
    input.crewColorIndex
  )
  const zIndexOffset = highlighted ? 1000 : 0

  if (!input.activeCrewFilterId) {
    return {
      color,
      opacity: 1,
      zIndexOffset,
      highlighted,
    }
  }

  const filteredCrew = input.crews.find(
    (crew) => crew.id === input.activeCrewFilterId
  )
  if (!filteredCrew || taskMatchesCrewId(task, filteredCrew)) {
    return {
      color,
      opacity: 1,
      zIndexOffset: highlighted ? 1000 : PLANNING_PIN_FILTERED_IN_Z_INDEX_BOOST,
      highlighted,
    }
  }

  return {
    color: PLANNING_PIN_COLOR_FILTERED_OUT,
    opacity: PLANNING_PIN_FILTERED_OUT_OPACITY,
    zIndexOffset,
    highlighted,
  }
}

export function isPlanningPinHighlighted(
  taskId: string,
  highlightedTaskId: string | null
): boolean {
  return Boolean(highlightedTaskId && taskId === highlightedTaskId)
}

export function buildPlanningMarkersViewKey(
  markers: Array<{
    task: Pick<
      Task,
      "id" | "dispatchOrder" | "executionOrder" | "crewId" | "status"
    >
    coordinates: PlanningTaskCoordinates
  }>
): string {
  return markers
    .map((marker) => {
      const crewId = marker.task.crewId ?? ""

      return [
        marker.task.id,
        marker.task.dispatchOrder ?? "",
        marker.task.executionOrder ?? "",
        marker.coordinates.latitude,
        marker.coordinates.longitude,
        crewId,
        marker.task.status,
      ].join(":")
    })
    .sort()
    .join(",")
}
