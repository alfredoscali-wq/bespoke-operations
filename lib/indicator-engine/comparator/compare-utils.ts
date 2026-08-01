import type {
  ComparisonIssue,
  ComparisonTolerance,
  FieldComparisonResult,
} from "@/lib/indicator-engine/comparator/types"

/**
 * Tolerance is accepted but not applied in Sprint 9 — reserved for later rules.
 */
export function noteTolerance(_tolerance?: ComparisonTolerance): void {
  void _tolerance
}

export function emptyFieldResult(comparisonTimeMs = 0): FieldComparisonResult {
  return {
    match: true,
    differences: [],
    missing: [],
    unexpected: [],
    comparisonTimeMs,
    coverage: { comparedFields: 0, matchedFields: 0, ratio: 1 },
  }
}

export function finalizeFieldResult(input: {
  differences: ComparisonIssue[]
  missing: ComparisonIssue[]
  unexpected: ComparisonIssue[]
  comparedFields: number
  matchedFields: number
  started: number
}): FieldComparisonResult {
  const comparisonTimeMs = Math.max(0, performance.now() - input.started)
  const { comparedFields, matchedFields } = input
  const ratio =
    comparedFields === 0 ? 1 : matchedFields / Math.max(1, comparedFields)

  return {
    match:
      input.differences.length === 0 &&
      input.missing.length === 0 &&
      input.unexpected.length === 0,
    differences: input.differences,
    missing: input.missing,
    unexpected: input.unexpected,
    comparisonTimeMs,
    coverage: {
      comparedFields,
      matchedFields,
      ratio,
    },
  }
}

export function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null && b == null) return true
  if (typeof a === "number" && typeof b === "number") {
    return Number.isFinite(a) && Number.isFinite(b) && a === b
  }
  return false
}

export function issue(
  path: string,
  expected: unknown,
  actual: unknown
): ComparisonIssue {
  return { path, expected, actual }
}
