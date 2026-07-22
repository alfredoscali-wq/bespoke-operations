import "server-only"

import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
  writeAuditLog,
} from "@/lib/audit"
import {
  FORCE_DELETE_ADMIN_ONLY_MESSAGE,
  FORCE_DELETE_NOT_FOUND_MESSAGE,
} from "@/lib/admin/force-delete-policy"
import type { ForceDeleteEntityType } from "@/lib/admin/force-delete-types"
import type { SessionUser } from "@/lib/auth/types"
import { resolveTenantCompanyId } from "@/lib/operations/tenant-scope"
import type { SupabaseAdminClient } from "@/lib/supabase/admin"

export type ForceDeleteResult = {
  success: true
  entityType: ForceDeleteEntityType
  entityId: string
  entityLabel: string
}

function assertAdministrator(sessionUser: SessionUser): void {
  if (sessionUser.systemRole !== "administrador") {
    throw new Error(FORCE_DELETE_ADMIN_ONLY_MESSAGE)
  }
}

async function softDeleteTaskIgnoringRules(
  client: SupabaseAdminClient,
  input: {
    taskId: string
    companyId: string
    sessionUser: SessionUser
  }
): Promise<ForceDeleteResult> {
  const { data: task, error: readError } = await client
    .from("tasks")
    .select("id, code, title, status, company_id, deleted_at")
    .eq("id", input.taskId)
    .eq("company_id", input.companyId)
    .maybeSingle()

  if (readError) {
    throw new Error(
      `No se pudo leer la orden de trabajo: ${readError.message}`
    )
  }

  if (!task || task.deleted_at) {
    throw new Error(FORCE_DELETE_NOT_FOUND_MESSAGE)
  }

  const deletedAt = new Date().toISOString()
  const { error: updateError } = await client
    .from("tasks")
    .update({ deleted_at: deletedAt })
    .eq("id", input.taskId)
    .eq("company_id", input.companyId)
    .is("deleted_at", null)

  if (updateError) {
    throw new Error(
      `No se pudo forzar la eliminación de la orden de trabajo: ${updateError.message}`
    )
  }

  const entityLabel = task.code?.trim() || task.title?.trim() || input.taskId
  const administratorName =
    input.sessionUser.displayName?.trim() || "Administrador"

  await writeAuditLog(client, {
    action: AUDIT_ACTIONS.FORCE_DELETE,
    module: AUDIT_MODULES.TAREAS,
    entityType: AUDIT_ENTITY_TYPES.TASK,
    entityId: input.taskId,
    entityLabel,
    description: `Administrador ${administratorName} forzó la eliminación (soft delete) de la OT ${entityLabel}.`,
    performedBy: { kind: "user", sessionUser: input.sessionUser },
    metadata: {
      forceDelete: true,
      softDelete: true,
      action: "FORCE_DELETE",
      status: task.status,
      code: task.code,
      title: task.title,
      deletedAt,
    },
  })

  const { recordTaskForceDeleteActivity } = await import(
    "@/lib/activity/adapters/projects-activity.server"
  )
  void recordTaskForceDeleteActivity({
    companyId: input.companyId,
    taskId: input.taskId,
    employeeId: input.sessionUser.employeeId,
    entityLabel,
  })

  return {
    success: true,
    entityType: "task",
    entityId: input.taskId,
    entityLabel,
  }
}

async function softDeleteProjectIgnoringRules(
  client: SupabaseAdminClient,
  input: {
    projectId: string
    companyId: string
    sessionUser: SessionUser
  }
): Promise<ForceDeleteResult> {
  const { data: project, error: readError } = await client
    .from("projects")
    .select("id, code, name, status, company_id, deleted_at")
    .eq("id", input.projectId)
    .eq("company_id", input.companyId)
    .maybeSingle()

  if (readError) {
    throw new Error(`No se pudo leer la obra: ${readError.message}`)
  }

  if (!project || project.deleted_at) {
    throw new Error(FORCE_DELETE_NOT_FOUND_MESSAGE)
  }

  const deletedAt = new Date().toISOString()

  // Soft-delete child OTs so they leave active operational lists with the obra.
  const { error: tasksError } = await client
    .from("tasks")
    .update({ deleted_at: deletedAt })
    .eq("project_id", input.projectId)
    .eq("company_id", input.companyId)
    .is("deleted_at", null)

  if (tasksError) {
    throw new Error(
      `No se pudieron forzar las eliminaciones de las OT de la obra: ${tasksError.message}`
    )
  }

  const { error: updateError } = await client
    .from("projects")
    .update({ deleted_at: deletedAt })
    .eq("id", input.projectId)
    .eq("company_id", input.companyId)
    .is("deleted_at", null)

  if (updateError) {
    throw new Error(
      `No se pudo forzar la eliminación de la obra: ${updateError.message}`
    )
  }

  const entityLabel =
    project.code?.trim() || project.name?.trim() || input.projectId
  const administratorName =
    input.sessionUser.displayName?.trim() || "Administrador"

  await writeAuditLog(client, {
    action: AUDIT_ACTIONS.FORCE_DELETE,
    module: AUDIT_MODULES.OBRAS,
    entityType: AUDIT_ENTITY_TYPES.PROJECT,
    entityId: input.projectId,
    entityLabel,
    description: `Administrador ${administratorName} forzó la eliminación (soft delete) de la obra ${entityLabel}.`,
    performedBy: { kind: "user", sessionUser: input.sessionUser },
    metadata: {
      forceDelete: true,
      softDelete: true,
      action: "FORCE_DELETE",
      status: project.status,
      code: project.code,
      name: project.name,
      deletedAt,
      cascadedTaskSoftDelete: true,
    },
  })

  return {
    success: true,
    entityType: "project",
    entityId: input.projectId,
    entityLabel,
  }
}

/**
 * Admin-only soft delete that bypasses operational business rules.
 * Never performs a physical DELETE.
 */
export async function executeForceDelete(
  client: SupabaseAdminClient,
  input: {
    entityType: ForceDeleteEntityType
    entityId: string
    sessionUser: SessionUser
  }
): Promise<ForceDeleteResult> {
  assertAdministrator(input.sessionUser)

  const companyId = resolveTenantCompanyId(input.sessionUser)
  const entityId = input.entityId.trim()

  if (!entityId) {
    throw new Error("entityId es obligatorio.")
  }

  if (input.entityType === "task") {
    return softDeleteTaskIgnoringRules(client, {
      taskId: entityId,
      companyId,
      sessionUser: input.sessionUser,
    })
  }

  return softDeleteProjectIgnoringRules(client, {
    projectId: entityId,
    companyId,
    sessionUser: input.sessionUser,
  })
}
