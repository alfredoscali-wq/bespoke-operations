export type OtLinkErrorCode =
  | "CONSULTATION_INVALID_PARAMETERS"
  | "CONSULTATION_NOT_FOUND"
  | "CONSULTATION_ALREADY_RESOLVED"
  | "CONSULTATION_ACTOR_TENANT_MISMATCH"
  | "TASK_NOT_FOUND"
  | "DEMO_READ_ONLY"
  | "RPC_FAILED"
  | "RPC_EMPTY"

export type OtLinkRpcResult = {
  atencionId: string
  linkedTaskId: string
  linkedTaskCode: string
  otLinkedAt: string
  otLinkedByEmployeeId: string
}

export function parseOtLinkRpcResult(data: unknown): OtLinkRpcResult | null {
  if (!data || typeof data !== "object") {
    return null
  }

  const record = data as Record<string, unknown>
  const atencionId = record.atencion_id
  const linkedTaskId = record.linked_task_id
  const linkedTaskCode = record.linked_task_code
  const otLinkedAt = record.ot_linked_at
  const otLinkedByEmployeeId = record.ot_linked_by_employee_id

  if (
    typeof atencionId !== "string" ||
    typeof linkedTaskId !== "string" ||
    typeof linkedTaskCode !== "string" ||
    typeof otLinkedAt !== "string" ||
    typeof otLinkedByEmployeeId !== "string"
  ) {
    return null
  }

  return {
    atencionId,
    linkedTaskId,
    linkedTaskCode,
    otLinkedAt,
    otLinkedByEmployeeId,
  }
}

export function mapOtLinkRpcError(message: string): {
  code: OtLinkErrorCode
  message: string
  status: number
} {
  const normalized = message || ""

  if (normalized.includes("TASK_NOT_FOUND") || normalized.includes("Orden de trabajo")) {
    return {
      code: "TASK_NOT_FOUND",
      message: "Orden de trabajo no encontrada.",
      status: 404,
    }
  }

  if (
    normalized.includes("CONSULTATION_ALREADY_RESOLVED") ||
    normalized.includes("consulta resuelta")
  ) {
    return {
      code: "CONSULTATION_ALREADY_RESOLVED",
      message: "No se puede vincular una OT a una consulta resuelta.",
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
    normalized.includes("solo lectura")
  ) {
    return {
      code: "DEMO_READ_ONLY",
      message: "La plataforma de demostración es de solo lectura.",
      status: 403,
    }
  }

  return {
    code: "RPC_FAILED",
    message: normalized || "No se pudo vincular la OT a la consulta.",
    status: 400,
  }
}
