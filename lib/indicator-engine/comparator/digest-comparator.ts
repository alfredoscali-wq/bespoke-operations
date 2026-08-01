import type { BusinessDigest } from "@/lib/indicator-engine/contracts/digest"
import {
  finalizeFieldResult,
  issue,
  noteTolerance,
  valuesEqual,
} from "@/lib/indicator-engine/comparator/compare-utils"
import type {
  ComparableDigestItem,
  ComparableDigestView,
  ComparisonIssue,
  ComparisonTolerance,
  FieldComparisonResult,
} from "@/lib/indicator-engine/comparator/types"

function normalizeItem(item: {
  action: string
  title: string
  description: string | null
  entityType: string
  entityId?: string | null
}): ComparableDigestItem {
  return {
    action: item.action,
    title: item.title,
    description: item.description,
    entityType: item.entityType,
    entityId: item.entityId ?? null,
  }
}

function itemKey(item: ComparableDigestItem): string {
  return [
    item.action,
    item.title,
    item.description ?? "",
    item.entityType,
    item.entityId ?? "",
  ].join("|")
}

export function digestViewFromBusiness(
  digest: BusinessDigest
): ComparableDigestView {
  return {
    items: digest.items.map((item) =>
      normalizeItem({
        action: item.action,
        title: item.title,
        description: item.description,
        entityType: item.entityType,
        entityId: item.entityId,
      })
    ),
  }
}

export function digestViewFromLegacyActivity(
  items: readonly {
    action: string
    title: string
    description: string | null
    entityType: string
    entityId?: string | null
  }[]
): ComparableDigestView {
  return { items: items.map(normalizeItem) }
}

/**
 * BusinessDigestComparator — narrative business content only.
 * Ignores item UUIDs, createdAt, employeeId, limit, versions, identity.
 * Multiset compare by business key (order-independent).
 */
export function compareDigests(
  legacy: ComparableDigestView,
  next: ComparableDigestView | BusinessDigest,
  tolerance?: ComparisonTolerance
): FieldComparisonResult {
  try {
    noteTolerance(tolerance)
    const started = performance.now()

    const left = legacy.items
    const right =
      "identity" in next
        ? digestViewFromBusiness(next).items
        : next.items

    const leftCounts = new Map<string, number>()
    const rightCounts = new Map<string, number>()
    const leftSample = new Map<string, ComparableDigestItem>()
    const rightSample = new Map<string, ComparableDigestItem>()

    for (const item of left) {
      const key = itemKey(item)
      leftCounts.set(key, (leftCounts.get(key) ?? 0) + 1)
      leftSample.set(key, item)
    }
    for (const item of right) {
      const key = itemKey(item)
      rightCounts.set(key, (rightCounts.get(key) ?? 0) + 1)
      rightSample.set(key, item)
    }

    const differences: ComparisonIssue[] = []
    const missing: ComparisonIssue[] = []
    const unexpected: ComparisonIssue[] = []
    let comparedFields = 0
    let matchedFields = 0

    const allKeys = [
      ...new Set([...leftCounts.keys(), ...rightCounts.keys()]),
    ].sort()

    for (const key of allKeys) {
      const path = `digest.items[${key}]`
      const lc = leftCounts.get(key) ?? 0
      const rc = rightCounts.get(key) ?? 0
      comparedFields += 1

      if (lc > 0 && rc === 0) {
        missing.push(issue(path, leftSample.get(key), undefined))
        continue
      }
      if (lc === 0 && rc > 0) {
        unexpected.push(issue(path, undefined, rightSample.get(key)))
        continue
      }
      if (!valuesEqual(lc, rc)) {
        differences.push(issue(`${path}.count`, lc, rc))
        continue
      }
      matchedFields += 1
    }

    return finalizeFieldResult({
      differences,
      missing,
      unexpected,
      comparedFields,
      matchedFields,
      started,
    })
  } catch {
    return {
      match: false,
      differences: [issue("digest", "comparison_failed", "comparison_failed")],
      missing: [],
      unexpected: [],
      comparisonTimeMs: 0,
      coverage: { comparedFields: 0, matchedFields: 0, ratio: 0 },
    }
  }
}

export const businessDigestComparator = {
  compare: compareDigests,
  fromBusiness: digestViewFromBusiness,
  fromLegacyActivity: digestViewFromLegacyActivity,
} as const
