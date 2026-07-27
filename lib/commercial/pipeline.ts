import {
  COMMERCIAL_STATUS_CODES,
  type CommercialSourceCode,
  type CommercialStatusCode,
} from "@/lib/commercial/catalogs"
import type {
  CommercialPipelineCard,
  CommercialPipelineFilters,
} from "@/lib/types/commercial-pipeline"

const TIMEZONE = "America/Argentina/Buenos_Aires"

function formatDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function resolvePipelineDayBounds(reference = new Date()): {
  dayStartIso: string
  dayEndIso: string
  todayKey: string
} {
  const todayKey = formatDayKey(reference)
  const dayStart = new Date(`${todayKey}T00:00:00-03:00`)
  const dayEnd = new Date(`${todayKey}T23:59:59.999-03:00`)
  return {
    dayStartIso: dayStart.toISOString(),
    dayEndIso: dayEnd.toISOString(),
    todayKey,
  }
}

export function daysSinceIso(iso: string | null | undefined, now = new Date()): number {
  if (!iso) return 0
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 0
  return Math.max(0, Math.floor((now.getTime() - then) / (24 * 60 * 60 * 1000)))
}

export function comparePipelineCards(
  left: CommercialPipelineCard,
  right: CommercialPipelineCard
): number {
  if (left.hasOverdueCommitment !== right.hasOverdueCommitment) {
    return left.hasOverdueCommitment ? -1 : 1
  }
  if (left.hasTodayCommitment !== right.hasTodayCommitment) {
    return left.hasTodayCommitment ? -1 : 1
  }

  const leftActivity = left.lastActivityAt ?? left.createdAt
  const rightActivity = right.lastActivityAt ?? right.createdAt
  if (leftActivity !== rightActivity) {
    return leftActivity < rightActivity ? -1 : 1
  }

  if (left.createdAt !== right.createdAt) {
    return left.createdAt < right.createdAt ? -1 : 1
  }

  return left.code.localeCompare(right.code, "es")
}

export function filterPipelineCards(
  cards: CommercialPipelineCard[],
  filters: CommercialPipelineFilters
): CommercialPipelineCard[] {
  const search = filters.search.trim().toLocaleLowerCase("es")
  const personQuery = filters.personQuery.trim().toLocaleLowerCase("es")
  const companyQuery = filters.companyQuery.trim().toLocaleLowerCase("es")
  const dateFrom = filters.dateFrom.trim()
  const dateTo = filters.dateTo.trim()

  return cards.filter((card) => {
    if (filters.assignedEmployeeId) {
      if (card.assignedEmployeeId !== filters.assignedEmployeeId) return false
    }
    if (filters.status && card.status !== filters.status) return false
    if (filters.source && card.source !== filters.source) return false

    if (personQuery && !card.personName.toLocaleLowerCase("es").includes(personQuery)) {
      return false
    }
    if (
      companyQuery &&
      !card.companyName.toLocaleLowerCase("es").includes(companyQuery)
    ) {
      return false
    }

    if (dateFrom && card.createdAt.slice(0, 10) < dateFrom) return false
    if (dateTo && card.createdAt.slice(0, 10) > dateTo) return false

    if (search) {
      const haystack = [card.code, card.personName, card.companyName, card.title]
        .join(" ")
        .toLocaleLowerCase("es")
      if (!haystack.includes(search)) return false
    }

    return true
  })
}

export function groupPipelineCardsByStatus(
  cards: CommercialPipelineCard[]
): Record<CommercialStatusCode, CommercialPipelineCard[]> {
  const groups = Object.fromEntries(
    COMMERCIAL_STATUS_CODES.map((status) => [status, [] as CommercialPipelineCard[]])
  ) as Record<CommercialStatusCode, CommercialPipelineCard[]>

  for (const card of cards) {
    groups[card.status]?.push(card)
  }

  for (const status of COMMERCIAL_STATUS_CODES) {
    groups[status].sort(comparePipelineCards)
  }

  return groups
}

export function emptyPipelineFilters(): CommercialPipelineFilters {
  return {
    search: "",
    assignedEmployeeId: "",
    status: "",
    source: "" as CommercialSourceCode | "",
    personQuery: "",
    companyQuery: "",
    dateFrom: "",
    dateTo: "",
  }
}
