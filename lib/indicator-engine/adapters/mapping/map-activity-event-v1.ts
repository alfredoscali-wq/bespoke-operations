import type { ActivityInputEvent } from "@/lib/indicator-engine/pipeline/stages/activity-input"
import type { ActivityEngineSourceEventV1 } from "@/lib/indicator-engine/adapters/activity-source"
import { canonicalizeAdapterModule } from "@/lib/indicator-engine/adapters/mapping/module-aliases"
import { projectBusinessMetadata } from "@/lib/indicator-engine/adapters/mapping/metadata-allowlist"

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function pickString(
  primary: unknown,
  fallback: unknown
): string | null {
  return asTrimmedString(primary) ?? asTrimmedString(fallback)
}

/**
 * Maps one Activity Engine V1-shaped object → business ActivityInputEvent.
 * Returns null when the event lacks required business fields (module/action/createdAt).
 */
export function mapActivityEngineEventV1ToInput(
  source: ActivityEngineSourceEventV1
): ActivityInputEvent | null {
  const moduleRaw = asTrimmedString(source.module)
  const action = asTrimmedString(source.action)
  const createdAt = pickString(source.createdAt, source.created_at)

  if (!moduleRaw || !action || !createdAt) {
    return null
  }

  const description =
    pickString(source.description, source.detail) ?? null

  return {
    id: asTrimmedString(source.id),
    module: canonicalizeAdapterModule(moduleRaw),
    action,
    entityType: pickString(source.entityType, source.entity_type),
    entityId: pickString(source.entityId, source.entity_id),
    employeeId: pickString(source.employeeId, source.employee_id),
    createdAt,
    metadata: projectBusinessMetadata(source.metadata),
    title: asTrimmedString(source.title),
    description,
  }
}
