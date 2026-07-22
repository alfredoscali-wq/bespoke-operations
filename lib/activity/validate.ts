import {
  isActivityAction,
  resolveActivityActionDefinition,
  resolveActivitySeverity,
} from "@/lib/activity/catalog"
import {
  ACTIVITY_ACTOR_TYPES,
  ACTIVITY_ORIGINS,
  ACTIVITY_SEVERITIES,
  type ActivityActorType,
  type ActivityEventRpcArgs,
  type ActivityOrigin,
  type ActivitySeverity,
  type RecordActivityEventInput,
} from "@/lib/activity/types"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim())
}

function isActivityOrigin(value: string): value is ActivityOrigin {
  return (Object.values(ACTIVITY_ORIGINS) as string[]).includes(value)
}

function isActivityActorType(value: string): value is ActivityActorType {
  return (Object.values(ACTIVITY_ACTOR_TYPES) as string[]).includes(value)
}

function isActivitySeverity(value: string): value is ActivitySeverity {
  return (Object.values(ACTIVITY_SEVERITIES) as string[]).includes(value)
}

/**
 * Validates catalog consistency and required fields.
 * Pure — safe for unit tests without DB.
 */
export function validateRecordActivityEventInput(
  input: RecordActivityEventInput
): void {
  if (!input.companyId?.trim() || !isUuid(input.companyId)) {
    throw new Error("Activity Engine: companyId debe ser un UUID válido.")
  }

  if (!isActivityAction(input.action)) {
    throw new Error(`Activity Engine: acción no reconocida: ${input.action}`)
  }

  const definition = resolveActivityActionDefinition(input.action)

  if (input.module !== definition.module) {
    throw new Error(
      `Activity Engine: el módulo ${input.module} no corresponde a ${input.action}.`
    )
  }

  if (input.entityType !== definition.entityType) {
    throw new Error(
      `Activity Engine: la entidad ${input.entityType} no corresponde a ${input.action}.`
    )
  }

  if (!isActivityActorType(input.actorType)) {
    throw new Error(`Activity Engine: actorType inválido: ${input.actorType}`)
  }

  if (!isActivityOrigin(input.origin)) {
    throw new Error(`Activity Engine: origin inválido: ${input.origin}`)
  }

  if (input.severity != null && !isActivitySeverity(input.severity)) {
    throw new Error(`Activity Engine: severity inválida: ${input.severity}`)
  }

  if (input.employeeId != null && input.employeeId !== "") {
    if (!isUuid(input.employeeId)) {
      throw new Error("Activity Engine: employeeId debe ser un UUID válido.")
    }
  }

  if (input.entityId != null && input.entityId !== "") {
    if (!isUuid(input.entityId)) {
      throw new Error("Activity Engine: entityId debe ser un UUID válido.")
    }
  }

  if (input.correlationId != null && input.correlationId !== "") {
    if (!isUuid(input.correlationId)) {
      throw new Error("Activity Engine: correlationId debe ser un UUID válido.")
    }
  }

  if (
    input.actorType === ACTIVITY_ACTOR_TYPES.SYSTEM &&
    input.employeeId != null &&
    input.employeeId !== ""
  ) {
    throw new Error(
      "Activity Engine: actor system no debe incluir employeeId."
    )
  }
}

/** Builds the RPC payload after validation. */
export function buildActivityEventRpcArgs(
  input: RecordActivityEventInput
): ActivityEventRpcArgs {
  validateRecordActivityEventInput(input)

  const severity =
    input.severity ?? resolveActivitySeverity(input.action)

  return {
    p_company_id: input.companyId.trim(),
    p_employee_id: input.employeeId?.trim() || null,
    p_actor_type: input.actorType,
    p_module: input.module,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId?.trim() || null,
    p_action: input.action,
    p_detail: input.detail?.trim() || "",
    p_metadata: { ...(input.metadata ?? {}) },
    p_origin: input.origin,
    p_correlation_id: input.correlationId?.trim() || null,
    p_severity: severity,
  }
}
