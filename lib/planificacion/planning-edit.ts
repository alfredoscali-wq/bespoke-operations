import {
  resolveCrewSnapshotsForAssignment,
  resolveTaskCrewId,
} from "@/lib/tasks/crew-relation"
import {
  normalizeScheduledTimeForDb,
} from "@/lib/tasks/scheduling"
import {
  resolveEstimatedDurationFromForm,
  resolveScheduledTimeFromShift,
  WORK_ORDER_DURATION_PRESET_MINUTES,
  type WorkOrderDurationPreset,
  type WorkOrderShift,
} from "@/lib/tasks/work-order"
import type { Crew } from "@/lib/types/crews"
import type { UpdateTaskPayload } from "@/lib/types/supabase/tasks"
import type { Task } from "@/lib/types/tasks"

import {
  dedupeExecutionOrderUpdates,
  resolveExecutionOrderOnCrewChange,
  type ExecutionOrderUpdate,
  type PlanningTaskUpdateBatch,
} from "@/lib/planificacion/planning-execution-order"
import {
  parseEstimatedDurationMinutes,
  resolveTaskShift,
} from "@/lib/planificacion/planning-utils"

export type PlanningEditFormState = {
  crewId: string
  shift: WorkOrderShift | ""
  estimatedDurationPreset: WorkOrderDurationPreset | ""
  estimatedDurationCustomMinutes: string
}

export const EMPTY_PLANNING_EDIT_FORM: PlanningEditFormState = {
  crewId: "",
  shift: "",
  estimatedDurationPreset: "",
  estimatedDurationCustomMinutes: "",
}

export function buildPlanningEditFormFromTask(
  task: Task,
  crews: Pick<Crew, "id" | "name">[] = []
): PlanningEditFormState {
  const { preset, customMinutes } = resolveDurationPresetFromTask(task)

  return {
    crewId: resolveTaskCrewId(task, crews) ?? "",
    shift: resolveTaskShift(task) ?? "",
    estimatedDurationPreset: preset,
    estimatedDurationCustomMinutes: customMinutes,
  }
}

export function resolveDurationPresetFromTask(task: Pick<Task, "estimatedDuration">): {
  preset: WorkOrderDurationPreset | ""
  customMinutes: string
} {
  const minutes = parseEstimatedDurationMinutes(task.estimatedDuration)
  if (minutes <= 0) {
    return { preset: "", customMinutes: "" }
  }

  if (
    WORK_ORDER_DURATION_PRESET_MINUTES.includes(
      minutes as (typeof WORK_ORDER_DURATION_PRESET_MINUTES)[number]
    )
  ) {
    return {
      preset: String(minutes) as WorkOrderDurationPreset,
      customMinutes: "",
    }
  }

  return {
    preset: "other",
    customMinutes: String(minutes),
  }
}

export function resolvePlanningEditEstimatedDuration(
  form: Pick<
    PlanningEditFormState,
    "estimatedDurationPreset" | "estimatedDurationCustomMinutes"
  >
): string {
  return resolveEstimatedDurationFromForm({
    estimatedDurationPreset: form.estimatedDurationPreset,
    estimatedDurationCustomMinutes: form.estimatedDurationCustomMinutes,
  })
}

export function validatePlanningEditForm(
  form: PlanningEditFormState
): { valid: boolean; message?: string } {
  if (!form.crewId) {
    return { valid: false, message: "Seleccione la cuadrilla." }
  }

  if (!form.shift) {
    return { valid: false, message: "Seleccione el turno." }
  }

  return { valid: true }
}

export function buildPlanningTaskUpdateBatch(input: {
  task: Task
  form: PlanningEditFormState
  crew: Pick<Crew, "id" | "name" | "supervisor"> | null
  allTasks: Task[]
  crews: Pick<Crew, "id" | "name">[]
}): PlanningTaskUpdateBatch {
  const { task, form, crew, allTasks, crews } = input
  const shift = form.shift as WorkOrderShift
  const snapshots = resolveCrewSnapshotsForAssignment(crew)
  const previousCrewId = resolveTaskCrewId(task, crews) ?? null
  const nextCrewId = form.crewId || null

  const executionOrderUpdates: ExecutionOrderUpdate[] =
    previousCrewId !== nextCrewId
      ? resolveExecutionOrderOnCrewChange({
          task,
          newCrewId: nextCrewId,
          allTasks,
          crews,
        })
      : []

  const primaryPayload: UpdateTaskPayload = {
    crewId: snapshots.crewId,
    crew: snapshots.crew,
    supervisor: snapshots.supervisor,
    scheduledTime: normalizeScheduledTimeForDb(resolveScheduledTimeFromShift(shift)),
    taskMetadata: {
      ...(task.taskMetadata ?? {}),
      shift,
    },
  }

  if (previousCrewId !== nextCrewId) {
    const taskOrderUpdate = executionOrderUpdates.find(
      (update) => update.taskId === task.id
    )
    if (taskOrderUpdate) {
      primaryPayload.executionOrder = taskOrderUpdate.executionOrder
    }
  }

  const relatedUpdates = dedupeExecutionOrderUpdates(
    executionOrderUpdates.filter((update) => update.taskId !== task.id)
  )

  return {
    primaryTaskId: task.id,
    primaryPayload,
    relatedUpdates,
  }
}

export function resolvePlanningTaskAddress(task: Task): string {
  const address = task.serviceAddress?.trim()
  const locality = task.locality?.trim()

  if (address && locality) {
    return `${address} · ${locality}`
  }

  return address || locality || "—"
}
