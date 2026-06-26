export type AuditFieldChange = {
  campo: string
  valor_anterior: string | null
  valor_nuevo: string | null
}

export function normalizeAuditValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed === "" ? null : trimmed
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  return JSON.stringify(value)
}

export function buildAuditFieldChanges<T extends object>(input: {
  before: T
  updates: Partial<Record<keyof T, unknown>>
  fields?: (keyof T)[]
  labels?: Partial<Record<keyof T, string>>
}): AuditFieldChange[] {
  const fields =
    input.fields ??
    (Object.keys(input.updates) as (keyof T)[]).filter(
      (field) => input.updates[field] !== undefined
    )

  const changes: AuditFieldChange[] = []

  for (const field of fields) {
    if (input.updates[field] === undefined) {
      continue
    }

    const previousValue = normalizeAuditValue(input.before[field])
    const nextValue = normalizeAuditValue(input.updates[field])

    if (previousValue === nextValue) {
      continue
    }

    changes.push({
      campo: input.labels?.[field] ?? String(field),
      valor_anterior: previousValue,
      valor_nuevo: nextValue,
    })
  }

  return changes
}

export function buildAuditChangeMetadata(changes: AuditFieldChange[]) {
  return {
    changedFields: changes.map((change) => change.campo),
    changes,
  }
}
