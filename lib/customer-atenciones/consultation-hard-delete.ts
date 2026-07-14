import type { SystemRole } from "@/lib/types/employees"

export const CONSULTATION_HARD_DELETE_SUCCESS_MESSAGE =
  "Consulta eliminada correctamente."

export const CONSULTATION_HARD_DELETE_ADMIN_ONLY_MESSAGE =
  "Solo un Administrador puede eliminar consultas."

export const CONSULTATION_HARD_DELETE_FAILED_MESSAGE =
  "No se pudo eliminar la consulta. Intente nuevamente."

export type ConsultationHardDeleteErrorCode =
  | "CONSULTATION_DELETE_ADMIN_REQUIRED"
  | "CONSULTATION_NOT_FOUND"
  | "CONSULTATION_INVALID_PARAMETERS"
  | "DEMO_READ_ONLY"
  | "RPC_FAILED"
  | "RPC_EMPTY"
  | "UNAUTHORIZED"
  | "FORBIDDEN"

export type ConsultationHardDeleteRpcResult = {
  atencionId: string
  deletedEvents: number
  clearedSeguimientos: number
}

export function canDeleteCustomerAtencionConsultation(
  systemRole: SystemRole | string | null | undefined
): boolean {
  return systemRole === "administrador"
}

export function parseConsultationHardDeleteRpcResult(
  data: unknown
): ConsultationHardDeleteRpcResult | null {
  if (!data || typeof data !== "object") {
    return null
  }

  const record = data as Record<string, unknown>
  const atencionId =
    typeof record.atencion_id === "string"
      ? record.atencion_id
      : typeof record.atencionId === "string"
        ? record.atencionId
        : null

  if (!atencionId) {
    return null
  }

  const deletedEvents = Number(record.deleted_events ?? record.deletedEvents ?? 0)
  const clearedSeguimientos = Number(
    record.cleared_seguimientos ?? record.clearedSeguimientos ?? 0
  )

  return {
    atencionId,
    deletedEvents: Number.isFinite(deletedEvents) ? deletedEvents : 0,
    clearedSeguimientos: Number.isFinite(clearedSeguimientos)
      ? clearedSeguimientos
      : 0,
  }
}

export function mapConsultationHardDeleteRpcError(
  message: string
): {
  code: ConsultationHardDeleteErrorCode
  message: string
  status: number
} {
  const normalized = message || ""

  if (
    normalized.includes("CONSULTATION_DELETE_ADMIN_REQUIRED") ||
    normalized.includes("Solo un Administrador puede eliminar")
  ) {
    return {
      code: "CONSULTATION_DELETE_ADMIN_REQUIRED",
      message: CONSULTATION_HARD_DELETE_ADMIN_ONLY_MESSAGE,
      status: 403,
    }
  }

  if (
    normalized.includes("CONSULTATION_NOT_FOUND") ||
    normalized.includes("no encontrada")
  ) {
    return {
      code: "CONSULTATION_NOT_FOUND",
      message: "Consulta no encontrada.",
      status: 404,
    }
  }

  if (
    normalized.includes("CONSULTATION_INVALID_PARAMETERS") ||
    normalized.includes("Parámetros incompletos")
  ) {
    return {
      code: "CONSULTATION_INVALID_PARAMETERS",
      message: "No se pudo eliminar la consulta por parámetros incompletos.",
      status: 400,
    }
  }

  if (
    normalized.includes("DEMO_READ_ONLY") ||
    normalized.includes("solo lectura") ||
    normalized.includes("demostración")
  ) {
    return {
      code: "DEMO_READ_ONLY",
      message: "La plataforma de demostración es de solo lectura.",
      status: 403,
    }
  }

  return {
    code: "RPC_FAILED",
    message: CONSULTATION_HARD_DELETE_FAILED_MESSAGE,
    status: 400,
  }
}
