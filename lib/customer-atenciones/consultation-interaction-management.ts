import type { ConsultationInteractionKind } from "@/lib/customer-atenciones/consultation-interaction"
import { isConsultationInteractionKind } from "@/lib/customer-atenciones/consultation-interaction"
import type { CustomerAtencionNextStep } from "@/lib/types/customer-atenciones"
import type { CustomerAtencionStatus } from "@/lib/types/customer-atenciones"

export type ConsultationInteractionErrorCode =
  | "INTERACTION_KIND_INVALID"
  | "INTERACTION_DETAIL_REQUIRED"
  | "CONSULTATION_ALREADY_RESOLVED"
  | "CONSULTATION_NOT_FOUND"
  | "CONSULTATION_ACTOR_TENANT_MISMATCH"
  | "CONSULTATION_INVALID_PARAMETERS"
  | "DEMO_READ_ONLY"
  | "RPC_FAILED"
  | "RPC_EMPTY"

export type ConsultationInteractionRpcResult = {
  atencionId: string
  eventId: string
  interactionKind: ConsultationInteractionKind
  interactionResult: string | null
  nextActionAt: string | null
  status: CustomerAtencionStatus
  nextStep: CustomerAtencionNextStep | null
  managementReleased: boolean
}

export function parseConsultationInteractionRpcResult(
  data: unknown
): ConsultationInteractionRpcResult | null {
  if (!data || typeof data !== "object") {
    return null
  }

  const record = data as Record<string, unknown>
  const atencionId = record.atencion_id
  const eventId = record.event_id
  const kind = record.interaction_kind
  const status = record.status

  if (
    typeof atencionId !== "string" ||
    typeof eventId !== "string" ||
    typeof kind !== "string" ||
    !isConsultationInteractionKind(kind) ||
    typeof status !== "string"
  ) {
    return null
  }

  const interactionResult =
    typeof record.interaction_result === "string"
      ? record.interaction_result
      : null
  const nextActionAt =
    typeof record.next_action_at === "string" ? record.next_action_at : null
  const nextStep =
    record.next_step === null || record.next_step === undefined
      ? null
      : typeof record.next_step === "string"
        ? (record.next_step as CustomerAtencionNextStep)
        : null
  const managementReleased = record.management_released === true

  return {
    atencionId,
    eventId,
    interactionKind: kind,
    interactionResult,
    nextActionAt,
    status: status as CustomerAtencionStatus,
    nextStep,
    managementReleased,
  }
}

export function mapConsultationInteractionRpcError(message: string): {
  code: ConsultationInteractionErrorCode
  message: string
  status: number
} {
  const normalized = message || ""

  if (
    normalized.includes("INTERACTION_KIND_INVALID") ||
    normalized.includes("Tipo de interacción")
  ) {
    return {
      code: "INTERACTION_KIND_INVALID",
      message: "Seleccioná un tipo de interacción válido.",
      status: 400,
    }
  }

  if (
    normalized.includes("INTERACTION_DETAIL_REQUIRED") ||
    normalized.includes("detalle de la interacción")
  ) {
    return {
      code: "INTERACTION_DETAIL_REQUIRED",
      message: "Completá el detalle de la interacción.",
      status: 400,
    }
  }

  if (
    normalized.includes("CONSULTATION_ALREADY_RESOLVED") ||
    normalized.includes("consulta resuelta")
  ) {
    return {
      code: "CONSULTATION_ALREADY_RESOLVED",
      message: "No se puede registrar interacciones en una consulta resuelta.",
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
    message: normalized || "No se pudo registrar la interacción.",
    status: 400,
  }
}
