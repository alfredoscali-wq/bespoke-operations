import {
  assertActivityResultAllowed,
  isActivityAction,
  resolveActivityActionDefinition,
  resolveActivitySeverity,
} from "@/lib/activity/catalog"
import {
  ACTIVITY_ACTOR_TYPES,
  ACTIVITY_ORIGINS,
  ACTIVITY_SEVERITIES,
  type ActivityActorType,
  type ActivityClientMetadata,
  type ActivityEventRpcArgs,
  type ActivityOrigin,
  type ActivitySeverity,
  type RecordActivityEventInput,
} from "@/lib/activity/types"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Soft upper bound — 48h — for duration_ms sanity checks. */
const MAX_DURATION_MS = 48 * 60 * 60 * 1000

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

function mergeClientIntoMetadata(
  metadata: Record<string, unknown>,
  client: ActivityClientMetadata | null | undefined
): Record<string, unknown> {
  if (!client) {
    return metadata
  }

  const existing =
    metadata.client &&
    typeof metadata.client === "object" &&
    !Array.isArray(metadata.client)
      ? { ...(metadata.client as Record<string, unknown>) }
      : {}

  const nextClient: Record<string, unknown> = { ...existing }

  if (client.deviceId != null && client.deviceId !== "") {
    nextClient.deviceId = client.deviceId
  }
  if (client.platform != null && client.platform !== "") {
    nextClient.platform = client.platform
  }
  if (client.appVersion != null && client.appVersion !== "") {
    nextClient.appVersion = client.appVersion
  }
  if (client.offlineSync != null) {
    nextClient.offlineSync = client.offlineSync
  }
  if (client.syncBatchId != null && client.syncBatchId !== "") {
    nextClient.syncBatchId = client.syncBatchId
  }
  if (client.networkType != null && client.networkType !== "") {
    nextClient.networkType = client.networkType
  }
  if (client.batteryPct != null) {
    if (
      typeof client.batteryPct !== "number" ||
      Number.isNaN(client.batteryPct) ||
      client.batteryPct < 0 ||
      client.batteryPct > 100
    ) {
      throw new Error(
        "Activity Engine: client.batteryPct debe estar entre 0 y 100."
      )
    }
    nextClient.batteryPct = client.batteryPct
  }

  if (Object.keys(nextClient).length === 0) {
    return metadata
  }

  return { ...metadata, client: nextClient }
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

  if (input.sessionId != null && input.sessionId !== "") {
    if (!isUuid(input.sessionId)) {
      throw new Error("Activity Engine: sessionId debe ser un UUID válido.")
    }
  }

  assertActivityResultAllowed(input.action, input.result ?? null)

  if (input.durationMs != null) {
    if (
      typeof input.durationMs !== "number" ||
      !Number.isFinite(input.durationMs) ||
      !Number.isInteger(input.durationMs) ||
      input.durationMs < 0
    ) {
      throw new Error(
        "Activity Engine: durationMs debe ser un entero >= 0."
      )
    }
    if (input.durationMs > MAX_DURATION_MS) {
      throw new Error(
        "Activity Engine: durationMs excede el máximo permitido (48h)."
      )
    }
  }

  if (input.geo != null) {
    const { latitude, longitude, accuracyM } = input.geo
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      Number.isNaN(latitude) ||
      Number.isNaN(longitude)
    ) {
      throw new Error(
        "Activity Engine: geo.latitude y geo.longitude deben ser números."
      )
    }
    if (latitude < -90 || latitude > 90) {
      throw new Error("Activity Engine: geo.latitude fuera de rango (-90..90).")
    }
    if (longitude < -180 || longitude > 180) {
      throw new Error(
        "Activity Engine: geo.longitude fuera de rango (-180..180)."
      )
    }
    if (accuracyM != null) {
      if (
        typeof accuracyM !== "number" ||
        Number.isNaN(accuracyM) ||
        accuracyM < 0
      ) {
        throw new Error(
          "Activity Engine: geo.accuracyM debe ser un número >= 0."
        )
      }
    }
  }

  if (input.client?.syncBatchId != null && input.client.syncBatchId !== "") {
    if (!isUuid(input.client.syncBatchId)) {
      throw new Error(
        "Activity Engine: client.syncBatchId debe ser un UUID válido."
      )
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

  const metadata = mergeClientIntoMetadata(
    { ...(input.metadata ?? {}) },
    input.client
  )

  return {
    p_company_id: input.companyId.trim(),
    p_employee_id: input.employeeId?.trim() || null,
    p_actor_type: input.actorType,
    p_module: input.module,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId?.trim() || null,
    p_action: input.action,
    p_detail: input.detail?.trim() || "",
    p_metadata: metadata,
    p_origin: input.origin,
    p_correlation_id: input.correlationId?.trim() || null,
    p_severity: severity,
    p_result: input.result ?? null,
    p_session_id: input.sessionId?.trim() || null,
    p_duration_ms: input.durationMs ?? null,
    p_latitude: input.geo?.latitude ?? null,
    p_longitude: input.geo?.longitude ?? null,
    p_accuracy_m: input.geo?.accuracyM ?? null,
  }
}
