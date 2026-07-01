const AUDIT_ENTITY_ID_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidAuditEntityId(value: string): boolean {
  return AUDIT_ENTITY_ID_UUID_PATTERN.test(value.trim())
}

/** system_audit_log.entity_id is uuid — non-UUID values are stored as null. */
export function normalizeAuditEntityId(
  entityId?: string | null
): string | null {
  if (!entityId?.trim()) {
    return null
  }

  const trimmed = entityId.trim()
  return isValidAuditEntityId(trimmed) ? trimmed : null
}
