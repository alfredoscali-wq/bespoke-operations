import { normalizeComparisonKey, isBlank } from "@/lib/customers/normalization/text"
import type {
  DuplicateMatch,
  DuplicateMatchKind,
  PreparedCommercialCustomer,
} from "@/lib/customers/commercial-migration/types"

type DuplicateIndex = Map<string, number[]>

function buildIndex(
  records: PreparedCommercialCustomer[],
  kind: DuplicateMatchKind,
  keyFn: (record: PreparedCommercialCustomer) => string | null
): DuplicateMatch[] {
  const index: DuplicateIndex = new Map()

  for (const record of records) {
    const key = keyFn(record)
    if (!key) continue
    const list = index.get(key) ?? []
    list.push(record.legacyId)
    index.set(key, list)
  }

  const groups: DuplicateMatch[] = []
  for (const [key, legacyIds] of index) {
    if (legacyIds.length < 2) continue
    groups.push({
      kind,
      key,
      legacyIds: [...legacyIds].sort((a, b) => a - b),
      count: legacyIds.length,
    })
  }

  return groups.sort((a, b) => b.count - a.count)
}

/**
 * Detecta duplicados en el dataset preparado.
 * NO resuelve automáticamente — solo identifica grupos conflictivos.
 */
export function detectLegacyDuplicateGroups(
  records: PreparedCommercialCustomer[]
): DuplicateMatch[] {
  return [
    ...buildIndex(records, "external_code", (r) => {
      const code = r.externalCustomerCode.trim()
      return code ? normalizeComparisonKey(code) : null
    }),
    ...buildIndex(records, "dni", (r) => {
      return r.dni ? r.dni : null
    }),
    ...buildIndex(records, "name", (r) => {
      const name = normalizeComparisonKey(r.name)
      return name || null
    }),
    ...buildIndex(records, "address", (r) => {
      const address = normalizeComparisonKey(r.address)
      return address || null
    }),
  ]
}

export function attachDuplicateFlagsToRecords(
  records: PreparedCommercialCustomer[],
  groups: DuplicateMatch[]
): PreparedCommercialCustomer[] {
  const flagsByLegacyId = new Map<number, Set<DuplicateMatchKind>>()

  for (const group of groups) {
    for (const legacyId of group.legacyIds) {
      const set = flagsByLegacyId.get(legacyId) ?? new Set()
      set.add(group.kind)
      flagsByLegacyId.set(legacyId, set)
    }
  }

  return records.map((record) => ({
    ...record,
    duplicateMatches: [...(flagsByLegacyId.get(record.legacyId) ?? [])],
  }))
}

export function isTestClientName(name: string): boolean {
  const normalized = normalizeComparisonKey(name)
  return (
    normalized.includes("test") ||
    normalized.includes("prueba") ||
    normalized.includes("demo") ||
    normalized === "xxx" ||
    normalized.startsWith("cliente prueba")
  )
}

export function observationMentionsBaja(observation: string): boolean {
  return normalizeComparisonKey(observation).includes("baja")
}

export function hasMinimumContactData(input: {
  phone: string
  email: string
  address: string
}): boolean {
  return (
    !isBlank(input.phone) || !isBlank(input.email) || !isBlank(input.address)
  )
}
