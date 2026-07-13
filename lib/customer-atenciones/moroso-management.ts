import type { MorosoTrackingStatus } from "@/lib/types/customer-atenciones"

import { isMorosoTrackingStatus } from "@/lib/customer-atenciones/moroso-flow"

export type MorosoTrackingErrorCode =
  | "MOROSO_TRACKING_STATUS_INVALID"
  | "MOROSO_TRACKING_NOT_APPLICABLE"
  | "CONSULTATION_ALREADY_RESOLVED"
  | "CONSULTATION_NOT_FOUND"
  | "CONSULTATION_ACTOR_TENANT_MISMATCH"
  | "CONSULTATION_INVALID_PARAMETERS"
  | "DEMO_READ_ONLY"
  | "RPC_FAILED"
  | "RPC_EMPTY"

export type MorosoTrackingRpcResult = {
  atencionId: string
  previousTrackingStatus: MorosoTrackingStatus | null
  newTrackingStatus: MorosoTrackingStatus
}

export function parseMorosoTrackingRpcResult(
  data: unknown
): MorosoTrackingRpcResult | null {
  if (!data || typeof data !== "object") {
    return null
  }

  const record = data as Record<string, unknown>
  const atencionId = record.atencion_id
  const newTrackingStatus = record.new_tracking_status

  if (typeof atencionId !== "string" || typeof newTrackingStatus !== "string") {
    return null
  }

  if (!isMorosoTrackingStatus(newTrackingStatus)) {
    return null
  }

  const previousRaw = record.previous_tracking_status
  const previousTrackingStatus =
    previousRaw === null || previousRaw === undefined
      ? null
      : typeof previousRaw === "string" && isMorosoTrackingStatus(previousRaw)
        ? previousRaw
        : null

  return {
    atencionId,
    previousTrackingStatus,
    newTrackingStatus,
  }
}

export function mapMorosoTrackingRpcError(message: string): {
  code: MorosoTrackingErrorCode
  message: string
  status: number
} {
  const normalized = message || ""

  if (
    normalized.includes("MOROSO_TRACKING_STATUS_INVALID") ||
    normalized.includes("estado de seguimiento válido")
  ) {
    return {
      code: "MOROSO_TRACKING_STATUS_INVALID",
      message: "Seleccioná un estado de seguimiento válido.",
      status: 400,
    }
  }

  if (
    normalized.includes("MOROSO_TRACKING_NOT_APPLICABLE") ||
    normalized.includes("solo aplica a consultas de Facturación - Morosos")
  ) {
    return {
      code: "MOROSO_TRACKING_NOT_APPLICABLE",
      message:
        "El seguimiento de morosos solo aplica a consultas de Facturación - Morosos.",
      status: 409,
    }
  }

  if (
    normalized.includes("CONSULTATION_ALREADY_RESOLVED") ||
    normalized.includes("consulta resuelta")
  ) {
    return {
      code: "CONSULTATION_ALREADY_RESOLVED",
      message: "No se puede actualizar el seguimiento de una consulta resuelta.",
      status: 409,
    }
  }

  if (normalized.includes("CONSULTATION_NOT_FOUND") || normalized.includes("no encontrada")) {
    return {
      code: "CONSULTATION_NOT_FOUND",
      message: "Consulta no encontrada.",
      status: 404,
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
    message: normalized || "No se pudo actualizar el seguimiento de morosos.",
    status: 400,
  }
}
