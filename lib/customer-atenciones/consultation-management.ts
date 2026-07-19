import type {
  CustomerAtencionNextStep,
  CustomerAtencionStatus,
} from "@/lib/types/customer-atenciones"

import {
  isCustomerAtencionNextStep,
  isCustomerAtencionStatus,
  resolveInitialConsultationStatusFromNextStep,
} from "@/lib/customer-atenciones/consultation"

export const CONSULTATION_MANAGEMENT_START_STATUSES = [
  "para_resolver",
  "pendiente",
] as const satisfies readonly CustomerAtencionStatus[]

export const CONSULTATION_DEFER_DEFAULT_RESOLUTION =
  "Consulta devuelta a la bandeja compartida."

export type ConsultationManagementErrorCode =
  | "CONSULTATION_ALREADY_IN_MANAGEMENT"
  | "CONSULTATION_OPERATOR_ALREADY_MANAGING"
  | "CONSULTATION_NOT_AVAILABLE_FOR_MANAGEMENT"
  | "CONSULTATION_NOT_FOUND"
  | "CONSULTATION_MANAGEMENT_ACTOR_MISMATCH"
  | "CONSULTATION_RESOLUTION_REQUIRED"
  | "CONSULTATION_NEXT_STEP_REQUIRED"
  | "CONSULTATION_ACTOR_TENANT_MISMATCH"
  | "CONSULTATION_INVALID_PARAMETERS"
  | "DEMO_READ_ONLY"
  | "RPC_FAILED"
  | "RPC_EMPTY"
  | "UNAUTHORIZED"
  | "FORBIDDEN"

export type ConsultationManagementRpcResult = {
  atencionId: string
  previousStatus: CustomerAtencionStatus
  newStatus: CustomerAtencionStatus
  previousNextStep: CustomerAtencionNextStep | null
  newNextStep: CustomerAtencionNextStep | null
  idempotent?: boolean
}

export function canStartConsultationManagement(
  status: CustomerAtencionStatus
): boolean {
  return (CONSULTATION_MANAGEMENT_START_STATUSES as readonly string[]).includes(
    status
  )
}

export function isConsultationManagedByEmployee(
  atencion: {
    status: CustomerAtencionStatus
    activeManagementEmployeeId?: string | null
  },
  employeeId: string
): boolean {
  return (
    atencion.status === "en_gestion" &&
    Boolean(employeeId) &&
    atencion.activeManagementEmployeeId === employeeId
  )
}

export function isConsultationManagedByAnotherEmployee(
  atencion: {
    status: CustomerAtencionStatus
    activeManagementEmployeeId?: string | null
  },
  employeeId: string
): boolean {
  return (
    atencion.status === "en_gestion" &&
    Boolean(atencion.activeManagementEmployeeId) &&
    atencion.activeManagementEmployeeId !== employeeId
  )
}

export function validateDeferConsultationNextStep(
  nextStep: string | undefined
): CustomerAtencionNextStep | { error: string } {
  if (!nextStep || !isCustomerAtencionNextStep(nextStep)) {
    return { error: "Seleccioná el próximo paso para continuar después." }
  }

  return nextStep
}

export function resolveDeferConsultationStatus(
  nextStep: CustomerAtencionNextStep
): CustomerAtencionStatus {
  return resolveInitialConsultationStatusFromNextStep(nextStep)
}

export function validateResolveConsultationResolution(
  resolution: string | undefined
): string | { error: string } {
  const trimmed = resolution?.trim() ?? ""

  if (!trimmed) {
    return { error: "Completá la resolución de la consulta." }
  }

  return trimmed
}

export function parseConsultationManagementRpcResult(
  data: unknown
): ConsultationManagementRpcResult | null {
  if (!data || typeof data !== "object") {
    return null
  }

  const record = data as Record<string, unknown>
  const atencionId = record.atencion_id
  const previousStatus = record.previous_status
  const newStatus = record.new_status

  if (
    typeof atencionId !== "string" ||
    typeof previousStatus !== "string" ||
    typeof newStatus !== "string" ||
    !isCustomerAtencionStatus(previousStatus) ||
    !isCustomerAtencionStatus(newStatus)
  ) {
    return null
  }

  const previousNextStepRaw = record.previous_next_step
  const newNextStepRaw = record.new_next_step

  const previousNextStep =
    previousNextStepRaw === null || previousNextStepRaw === undefined
      ? null
      : typeof previousNextStepRaw === "string" &&
          isCustomerAtencionNextStep(previousNextStepRaw)
        ? previousNextStepRaw
        : null

  const newNextStep =
    newNextStepRaw === null || newNextStepRaw === undefined
      ? null
      : typeof newNextStepRaw === "string" &&
          isCustomerAtencionNextStep(newNextStepRaw)
        ? newNextStepRaw
        : null

  return {
    atencionId,
    previousStatus,
    newStatus,
    previousNextStep,
    newNextStep,
    idempotent: record.idempotent === true,
  }
}

export function mapConsultationManagementRpcError(
  message: string
): { code: ConsultationManagementErrorCode; message: string; status: number } {
  const normalized = message || ""

  if (
    normalized.includes("CONSULTATION_ALREADY_IN_MANAGEMENT") ||
    normalized.includes("ya está siendo gestionada")
  ) {
    return {
      code: "CONSULTATION_ALREADY_IN_MANAGEMENT",
      message: normalized.includes("manager_employee_id=")
        ? normalized
        : "Esta Consulta ya está siendo gestionada por otra persona.",
      status: 409,
    }
  }

  if (
    normalized.includes("CONSULTATION_OPERATOR_ALREADY_MANAGING") ||
    normalized.includes("Ya tenés otra consulta en gestión")
  ) {
    return {
      code: "CONSULTATION_OPERATOR_ALREADY_MANAGING",
      message: normalized.includes("blocking_atencion_id=")
        ? normalized
        : "Ya tenés otra consulta en gestión. Finalizala o cancelala antes de comenzar una nueva.",
      status: 409,
    }
  }

  if (
    normalized.includes("CONSULTATION_NOT_AVAILABLE_FOR_MANAGEMENT") ||
    normalized.includes("no está disponible para iniciar gestión")
  ) {
    return {
      code: "CONSULTATION_NOT_AVAILABLE_FOR_MANAGEMENT",
      message: "La Consulta no está disponible para iniciar gestión.",
      status: 409,
    }
  }

  if (
    normalized.includes("CONSULTATION_MANAGEMENT_ACTOR_MISMATCH") ||
    normalized.includes("Solo quien gestiona actualmente")
  ) {
    return {
      code: "CONSULTATION_MANAGEMENT_ACTOR_MISMATCH",
      message: "Solo quien gestiona actualmente la Consulta puede realizar esta acción.",
      status: 403,
    }
  }

  if (
    normalized.includes("CONSULTATION_RESOLUTION_REQUIRED") ||
    normalized.includes("Completá la resolución")
  ) {
    return {
      code: "CONSULTATION_RESOLUTION_REQUIRED",
      message: "Completá la resolución de la consulta.",
      status: 400,
    }
  }

  if (
    normalized.includes("CONSULTATION_NEXT_STEP_REQUIRED") ||
    normalized.includes("próximo paso")
  ) {
    return {
      code: "CONSULTATION_NEXT_STEP_REQUIRED",
      message: "Seleccioná el próximo paso para continuar después.",
      status: 400,
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
    message: normalized || "No se pudo completar la acción sobre la Consulta.",
    status: 400,
  }
}
