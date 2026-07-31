/**
 * Input accepted by the canonical Activity Engine writer.
 *
 * `metadata` is intentionally unstructured. Callers may provide any JSON
 * object without registering or validating a schema.
 */
export type RecordActivityInput = {
  companyId: string
  employeeId?: string | null
  appUserId?: string | null
  module: string
  entityType: string
  entityId?: string | null
  action: string
  title: string
  description?: string | null
  metadata?: Record<string, unknown>
}

export type RecordActivityResult = {
  id: string
}
