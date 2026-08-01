/**
 * In-memory indexes for Análisis report lookups (Sprint 17).
 * Replaces repeated .find() over crews / projects / employees.
 */

export function buildIdNameMap(
  rows: readonly { id: string; name: string }[]
): Map<string, string> {
  const map = new Map<string, string>()
  for (const row of rows) {
    map.set(row.id, row.name)
  }
  return map
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase("es")
}

/**
 * Crew indexes: by id and by normalized name (legacy task.crew snapshots).
 */
export function buildCrewLookupIndexes(
  crews: readonly { id: string; name: string }[]
): {
  byId: Map<string, string>
  byNormalizedName: Map<string, string>
} {
  const byId = new Map<string, string>()
  const byNormalizedName = new Map<string, string>()
  for (const crew of crews) {
    byId.set(crew.id, crew.name)
    byNormalizedName.set(normalizeName(crew.name), crew.id)
  }
  return { byId, byNormalizedName }
}

export function resolveCrewIdFromIndexes(
  task: { crewId?: string; crew?: string },
  indexes: {
    byId: Map<string, string>
    byNormalizedName: Map<string, string>
  }
): string | undefined {
  if (task.crewId) return task.crewId
  const snapshot = task.crew?.trim()
  if (!snapshot) return undefined
  return indexes.byNormalizedName.get(normalizeName(snapshot))
}
