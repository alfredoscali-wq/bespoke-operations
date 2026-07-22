import "server-only"

import { recordActivityEventSafe } from "@/lib/activity/activity-service"
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ACTOR_TYPES,
  ACTIVITY_ENTITY_TYPES,
  ACTIVITY_MODULES,
  ACTIVITY_ORIGINS,
} from "@/lib/activity/types"

export async function recordProjectStartActivity(input: {
  companyId: string
  projectId: string
  employeeId?: string | null
  projectCode?: string | null
  projectName?: string | null
  taskCount?: number | null
}): Promise<void> {
  await recordActivityEventSafe({
    companyId: input.companyId,
    employeeId: input.employeeId ?? null,
    actorType: input.employeeId
      ? ACTIVITY_ACTOR_TYPES.EMPLOYEE
      : ACTIVITY_ACTOR_TYPES.USER,
    module: ACTIVITY_MODULES.PROJECTS,
    entityType: ACTIVITY_ENTITY_TYPES.PROJECT,
    entityId: input.projectId,
    action: ACTIVITY_ACTIONS.PROJECT_START,
    detail: "Obra iniciada (despacho operativo).",
    metadata: {
      projectCode: input.projectCode ?? null,
      projectName: input.projectName ?? null,
      taskCount: input.taskCount ?? null,
    },
    origin: ACTIVITY_ORIGINS.WEB,
  })
}

export async function recordTaskForceDeleteActivity(input: {
  companyId: string
  taskId: string
  employeeId?: string | null
  entityLabel: string
}): Promise<void> {
  await recordActivityEventSafe({
    companyId: input.companyId,
    employeeId: input.employeeId ?? null,
    actorType: input.employeeId
      ? ACTIVITY_ACTOR_TYPES.EMPLOYEE
      : ACTIVITY_ACTOR_TYPES.USER,
    module: ACTIVITY_MODULES.TASKS,
    entityType: ACTIVITY_ENTITY_TYPES.TASK,
    entityId: input.taskId,
    action: ACTIVITY_ACTIONS.TASK_FORCE_DELETE,
    detail: `Force delete de OT ${input.entityLabel}.`,
    metadata: {
      entityLabel: input.entityLabel,
    },
    origin: ACTIVITY_ORIGINS.WEB,
  })
}

export async function recordTaskReferencePhotoDeleteActivity(input: {
  companyId: string
  taskId: string
  photoId: string
  employeeId?: string | null
}): Promise<void> {
  await recordActivityEventSafe({
    companyId: input.companyId,
    employeeId: input.employeeId ?? null,
    actorType: input.employeeId
      ? ACTIVITY_ACTOR_TYPES.EMPLOYEE
      : ACTIVITY_ACTOR_TYPES.USER,
    module: ACTIVITY_MODULES.TASKS,
    entityType: ACTIVITY_ENTITY_TYPES.TASK,
    entityId: input.taskId,
    action: ACTIVITY_ACTIONS.TASK_REFERENCE_PHOTO_DELETE,
    detail: "Foto de referencia eliminada.",
    metadata: {
      photoId: input.photoId,
    },
    origin: ACTIVITY_ORIGINS.WEB,
  })
}
