/**
 * Shared source shapes for CUADRILLAS (no server-only).
 */

import type {
  CrewProductionSourceCrew,
  CrewProductionSourceTask,
} from "@/lib/analysis/crew-production/types"
import type {
  PlanningTimelineSourceCrew,
  PlanningTimelineSourceTask,
} from "@/lib/analysis/planning-timeline/types"

export type CrewsSourceTask = PlanningTimelineSourceTask & {
  code: string
  workOrderNumber?: string
  projectName?: string
  dueDate: string
}

export function toProductionCrews(
  crews: PlanningTimelineSourceCrew[]
): CrewProductionSourceCrew[] {
  return crews.map((crew) => ({
    id: crew.id,
    name: crew.name,
    status: crew.status,
    memberCount: crew.members.filter((member) => member.active).length,
  }))
}

export function toProductionTasks(
  tasks: CrewsSourceTask[]
): CrewProductionSourceTask[] {
  return tasks.map((task) => ({
    id: task.id,
    code: task.code,
    title: task.title,
    status: task.status,
    dueDate: task.dueDate,
    estimatedDuration: task.estimatedDuration,
    customerName: task.customerName ?? undefined,
    crewId: task.crewId ?? undefined,
    crew: task.crew,
    workOrderNumber: task.workOrderNumber,
    taskMetadata: task.taskMetadata,
  }))
}
