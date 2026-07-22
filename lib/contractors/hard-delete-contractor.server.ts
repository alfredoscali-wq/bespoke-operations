import "server-only"

import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
  writeAuditLog,
} from "@/lib/audit"
import type { SessionUser } from "@/lib/auth/types"
import { createAdminClient } from "@/lib/supabase/admin"

type AdminRpcClient = {
  rpc(
    fn: "hard_delete_contractor",
    args: {
      p_company_id: string
      p_contractor_id: string
      p_actor_employee_id: string
    }
  ): Promise<{ data: unknown; error: { message: string } | null }>
}

export type HardDeleteContractorRpcResult = {
  contractorId: string
  legalName: string
  deletedCrews: number
  deletedEmployees: number
  deletedCrewMembers: number
  deletedShifts: number
  appUserIds: string[]
}

export type HardDeleteContractorResult =
  | { success: true; data: HardDeleteContractorRpcResult }
  | { success: false; error: string }

function parseRpcResult(data: unknown): HardDeleteContractorRpcResult | null {
  if (!data || typeof data !== "object") return null
  const row = data as Record<string, unknown>
  const contractorId =
    typeof row.contractor_id === "string" ? row.contractor_id : null
  const legalName = typeof row.legal_name === "string" ? row.legal_name : ""
  if (!contractorId) return null

  const appUserIdsRaw = row.app_user_ids
  const appUserIds = Array.isArray(appUserIdsRaw)
    ? appUserIdsRaw.filter((id): id is string => typeof id === "string")
    : []

  return {
    contractorId,
    legalName,
    deletedCrews: Number(row.deleted_crews ?? 0),
    deletedEmployees: Number(row.deleted_employees ?? 0),
    deletedCrewMembers: Number(row.deleted_crew_members ?? 0),
    deletedShifts: Number(row.deleted_shifts ?? 0),
    appUserIds,
  }
}

function mapRpcError(message: string): string {
  if (message.includes("CONTRACTOR_DELETE_ADMIN_REQUIRED")) {
    return "Solo un Administrador puede eliminar definitivamente un contratista."
  }
  if (message.includes("CONTRACTOR_NOT_FOUND")) {
    return "Contratista no encontrado."
  }
  if (message.includes("CONTRACTOR_HAS_OPERATIONAL_HISTORY")) {
    return "No se puede eliminar definitivamente: hay usuarios del contratista con incidencias registradas."
  }
  if (message.includes("DEMO_READ_ONLY")) {
    return "La plataforma de demostración es de solo lectura."
  }
  if (message.includes("CONTRACTOR_INVALID_PARAMETERS")) {
    return "Parámetros incompletos para eliminar el contratista."
  }
  return message || "No se pudo eliminar definitivamente el contratista."
}

async function deleteAuthUsers(appUserIds: string[]): Promise<void> {
  if (appUserIds.length === 0) return

  const admin = createAdminClient()
  for (const authUserId of appUserIds) {
    const { error } = await admin.auth.admin.deleteUser(authUserId)
    if (error) {
      console.error("[CONTRACTOR_HARD_DELETE_AUTH]", {
        authUserId,
        message: error.message,
      })
    }
  }
}

/**
 * Permanently deletes a contractor, its external crews and users (DB transaction),
 * then removes linked Auth users.
 */
export async function hardDeleteContractor(input: {
  companyId: string
  contractorId: string
  sessionUser: SessionUser
}): Promise<HardDeleteContractorResult> {
  const actorEmployeeId = input.sessionUser.employeeId?.trim()
  if (!actorEmployeeId) {
    return {
      success: false,
      error: "No se pudo identificar al administrador que ejecuta la acción.",
    }
  }

  const admin = createAdminClient()
  const { data, error } = await (admin as unknown as AdminRpcClient).rpc(
    "hard_delete_contractor",
    {
      p_company_id: input.companyId,
      p_contractor_id: input.contractorId,
      p_actor_employee_id: actorEmployeeId,
    }
  )

  if (error) {
    return { success: false, error: mapRpcError(error.message || "") }
  }

  const parsed = parseRpcResult(data)
  if (!parsed) {
    return {
      success: false,
      error: "La eliminación no devolvió un resultado válido.",
    }
  }

  await deleteAuthUsers(parsed.appUserIds)

  const administratorName =
    input.sessionUser.displayName?.trim() || "Administrador"
  const entityLabel = parsed.legalName.trim() || input.contractorId

  try {
    await writeAuditLog(admin, {
      action: AUDIT_ACTIONS.CONTRACTOR_DELETE_PERMANENT,
      module: AUDIT_MODULES.CONTRATISTAS,
      entityType: AUDIT_ENTITY_TYPES.CONTRACTOR,
      entityId: parsed.contractorId,
      entityLabel,
      description: `Administrador ${administratorName} eliminó definitivamente el contratista ${entityLabel}.`,
      performedBy: { kind: "user", sessionUser: input.sessionUser },
      metadata: {
        deletedCrews: parsed.deletedCrews,
        deletedEmployees: parsed.deletedEmployees,
        deletedCrewMembers: parsed.deletedCrewMembers,
        deletedShifts: parsed.deletedShifts,
        deletedAuthUsers: parsed.appUserIds.length,
      },
    })
  } catch (auditError) {
    console.error("[CONTRACTOR_HARD_DELETE_AUDIT]", auditError)
  }

  return { success: true, data: parsed }
}
