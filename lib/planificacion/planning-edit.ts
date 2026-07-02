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
  buildOperationalOrderAssignmentUpdates,
  dedupeExecutionOrderUpdates,
  parseOperationalOrderInput,
  resolveNextOperationalOrderProposal,
  resolveOperationalOrderFormDefault,
  resolveOperationalOrderOnCrewChange,
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
  operationalOrder: string
}

export const EMPTY_PLANNING_EDIT_FORM: PlanningEditFormState = {
  crewId: "",
  shift: "",
  estimatedDurationPreset: "",
  estimatedDurationCustomMinutes: "",
  operationalOrder: "",
}

export function buildPlanningEditFormFromTask(
  task: Task,
  allTasks: Task[],
  crews: Pick<Crew, "id" | "name">[] = []
): PlanningEditFormState {
  const { preset, customMinutes } = resolveDurationPresetFromTask(task)
  const crewId = resolveTaskCrewId(task, crews) ?? ""

  return {
    crewId,
    shift: resolveTaskShift(task) ?? "",
    estimatedDurationPreset: preset,
    estimatedDurationCustomMinutes: customMinutes,
    operationalOrder: resolveOperationalOrderFormDefault({
      task,
      crewId,
      dueDate: task.dueDate,
      allTasks,
      crews,
    }),
  }
}

export function resolveOperationalOrderProposalForCrew(input: {
  task: Task
  crewId: string
  dueDate: string
  allTasks: Task[]
  crews: Pick<Crew, "id" | "name">[]
}): string {
  const { task, crewId, dueDate, allTasks, crews } = input

  if (!crewId) {
    return ""
  }

  return String(
    resolveNextOperationalOrderProposal({
      tasks: allTasks,
      dueDate,
      crewId,
      crews,
      excludeTaskId: task.id,
    })
  )
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

  const orderValidation = parseOperationalOrderInput(form.operationalOrder)
  if (!orderValidation.valid) {
    return { valid: false, message: orderValidation.message }
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
  const orderValidation = parseOperationalOrderInput(form.operationalOrder)
  const desiredOrder = orderValidation.valid ? orderValidation.order : null

  const executionOrderUpdates: ExecutionOrderUpdate[] = []

  if (previousCrewId !== nextCrewId) {
    executionOrderUpdates.push(
      ...resolveOperationalOrderOnCrewChange({
        task,
        newCrewId: nextCrewId,
        newDueDate: task.dueDate,
        desiredOrder,
        allTasks,
        crews,
      })
    )
  } else if (nextCrewId && desiredOrder != null) {
    executionOrderUpdates.push(
      ...buildOperationalOrderAssignmentUpdates({
        tasks: allTasks,
        dueDate: task.dueDate,
        crewId: nextCrewId,
        taskId: task.id,
        desiredOrder,
        crews,
      })
    )
  }

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

  const taskOrderUpdate = executionOrderUpdates.find(
    (update) => update.taskId === task.id
  )
  if (taskOrderUpdate) {
    primaryPayload.executionOrder = taskOrderUpdate.executionOrder
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
