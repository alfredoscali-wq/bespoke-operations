import { abnetPadronCustomerNumber } from "@/lib/subscriptions/abnet-tv-padron"

export const ABNET_TV_PADRON_REMOVE_ACTION = "remove_from_tv_padron"

export type AbnetPadronExclusion = {
  companyId: string
  source: string
  sourceRow: number
  abnetCustomerNumber: string
  deletedAt?: string | null
}

export type AbnetPadronRemovalPlan =
  | { outcome: "already_removed" }
  | { outcome: "not_found" }
  | {
      outcome: "create"
      source: string
      sourceRow: number
      abnetCustomerNumber: string
    }

function samePadronRow(
  left: { source: string; sourceRow: number },
  right: { source: string; sourceRow: number }
) {
  return left.source === right.source && left.sourceRow === right.sourceRow
}

function sameCustomerNumber(left: string, right: string) {
  const normalizedLeft = abnetPadronCustomerNumber(left) ?? left.trim()
  const normalizedRight = abnetPadronCustomerNumber(right) ?? right.trim()
  return normalizedLeft !== "" && normalizedLeft === normalizedRight
}

export function activeAbnetPadronExclusions(
  exclusions: readonly AbnetPadronExclusion[],
  companyId: string
) {
  return exclusions.filter(
    (exclusion) => exclusion.companyId === companyId && exclusion.deletedAt == null
  )
}

/** Active exclusions hide that Excel row. A revoked exclusion does not. */
export function excludeAbnetPadronRows<T extends { source: string; sourceRow: number }>(
  rows: readonly T[],
  exclusions: readonly AbnetPadronExclusion[],
  companyId: string
): T[] {
  const hidden = new Set(
    activeAbnetPadronExclusions(exclusions, companyId).map(
      (exclusion) => `${exclusion.source}\0${exclusion.sourceRow}`
    )
  )
  return rows.filter((row) => !hidden.has(`${row.source}\0${row.sourceRow}`))
}

/**
 * One padron line, not the customer number.
 * Another company's exclusion never matches.
 */
export function planAbnetTvPadronRemoval(input: {
  companyId: string
  source: string
  sourceRow: number
  abnetCustomerNumber: string
  rows: readonly {
    source: string
    sourceRow: number
    abnetCustomerNumber: string
  }[]
  exclusions: readonly AbnetPadronExclusion[]
}): AbnetPadronRemovalPlan {
  const requested = abnetPadronCustomerNumber(input.abnetCustomerNumber)
  if (!requested || !Number.isInteger(input.sourceRow) || input.sourceRow <= 0) {
    return { outcome: "not_found" }
  }
  const target = {
    source: input.source,
    sourceRow: input.sourceRow,
  }
  const active = activeAbnetPadronExclusions(input.exclusions, input.companyId).filter(
    (exclusion) => samePadronRow(exclusion, target)
  )
  if (active.length > 0) {
    return active.some((exclusion) =>
      sameCustomerNumber(exclusion.abnetCustomerNumber, requested)
    )
      ? { outcome: "already_removed" }
      : { outcome: "not_found" }
  }
  const row = input.rows.find(
    (candidate) =>
      samePadronRow(candidate, target) &&
      sameCustomerNumber(candidate.abnetCustomerNumber, requested)
  )
  if (!row) return { outcome: "not_found" }
  return {
    outcome: "create",
    source: row.source,
    sourceRow: row.sourceRow,
    abnetCustomerNumber: abnetPadronCustomerNumber(row.abnetCustomerNumber) ?? requested,
  }
}

/** Inserts the exclusion once. A second call keeps the same active row. */
export function commitAbnetPadronExclusion(
  exclusions: readonly AbnetPadronExclusion[],
  input: {
    companyId: string
    source: string
    sourceRow: number
    abnetCustomerNumber: string
    rows: readonly {
      source: string
      sourceRow: number
      abnetCustomerNumber: string
    }[]
  }
): { exclusions: AbnetPadronExclusion[]; created: boolean } {
  const plan = planAbnetTvPadronRemoval({ ...input, exclusions })
  if (plan.outcome !== "create") {
    return { exclusions: [...exclusions], created: false }
  }
  return {
    created: true,
    exclusions: [
      ...exclusions,
      {
        companyId: input.companyId,
        source: plan.source,
        sourceRow: plan.sourceRow,
        abnetCustomerNumber: plan.abnetCustomerNumber,
        deletedAt: null,
      },
    ],
  }
}

export function clampAbnetPadronPage(
  page: number,
  total: number,
  pageSize: number
): number {
  const size = pageSize > 0 ? pageSize : 1
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / size))
  const current = Number.isFinite(page) ? Math.trunc(page) : 1
  return Math.min(Math.max(1, current), totalPages)
}
