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
  if (!form.shift) {
    return { valid: false, message: "Seleccione el turno." }
  }

  if (!resolvePlanningEditEstimatedDuration(form)) {
    return { valid: false, message: "La duración estimada es obligatoria." }
  }

  return { valid: true }
}

export function buildPlanningTaskUpdatePayload(input: {
  task: Task
  form: PlanningEditFormState
  crew: Pick<Crew, "id" | "name" | "supervisor"> | null
}): UpdateTaskPayload {
  const { task, form, crew } = input
  const estimatedDuration = resolvePlanningEditEstimatedDuration(form)
  const shift = form.shift as WorkOrderShift
  const snapshots = resolveCrewSnapshotsForAssignment(crew)

  return {
    crewId: snapshots.crewId,
    crew: snapshots.crew,
    supervisor: snapshots.supervisor,
    scheduledTime: normalizeScheduledTimeForDb(resolveScheduledTimeFromShift(shift)),
    estimatedDuration,
    taskMetadata: {
      ...(task.taskMetadata ?? {}),
      shift,
    },
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
