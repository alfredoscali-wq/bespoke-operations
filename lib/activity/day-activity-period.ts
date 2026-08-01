/**
 * UX period for Actividad de la Jornada — Sprint 26.
 * Presets match the official Análisis date-range model.
 */

import { todayDateInputValue } from "@/lib/activity/employee-daily-report"
import {
  createDefaultAnalysisDateRange,
  resolveAnalysisDateRange,
} from "@/lib/analysis/date-range/resolve"
import {
  ANALYSIS_DATE_RANGE_PRESET_OPTIONS,
  type AnalysisDateRangePreset,
  type AnalysisDateRangeValue,
} from "@/lib/analysis/date-range/types"

export type DayActivityPeriodPreset = AnalysisDateRangePreset

export type DayActivityPeriodSelection = {
  preset: DayActivityPeriodPreset
  /** YYYY-MM-DD — only for custom */
  customFrom?: string
  /** YYYY-MM-DD — only for custom */
  customTo?: string
}

export type DayActivityPeriodRange = {
  dateFromInput: string
  dateToInput: string
}

export type DayActivityPeriodCopy = {
  productionTitle: string
  narrativePrefix: string
  periodLabel: string
  scopeNoun: "día" | "semana" | "mes" | "período"
}

const STORAGE_KEY = "bespoke.activity.jornada.period.v2"
const LEGACY_STORAGE_KEY = "bespoke.activity.jornada.period.v1"

export const DAY_ACTIVITY_PERIOD_OPTIONS = ANALYSIS_DATE_RANGE_PRESET_OPTIONS

export function resolveDayActivityPeriodRange(
  selection: DayActivityPeriodSelection,
  now: Date = new Date()
): DayActivityPeriodRange {
  try {
    const range = resolveAnalysisDateRange({
      preset: selection.preset,
      dateFrom: selection.customFrom,
      dateTo: selection.customTo,
      referenceDate: now,
    })
    return {
      dateFromInput: range.dateFrom,
      dateToInput: range.dateTo,
    }
  } catch {
    const today = todayDateInputValue(now)
    return { dateFromInput: today, dateToInput: today }
  }
}

export function getDayActivityPeriodCopy(
  selection: DayActivityPeriodSelection,
  range: DayActivityPeriodRange
): DayActivityPeriodCopy {
  switch (selection.preset) {
    case "today":
      return {
        productionTitle: "Producción del día",
        narrativePrefix: "Durante el día",
        periodLabel: "Hoy",
        scopeNoun: "día",
      }
    case "yesterday":
      return {
        productionTitle: "Producción del día",
        narrativePrefix: "Durante la jornada de ayer",
        periodLabel: "Ayer",
        scopeNoun: "día",
      }
    case "last_7_days":
      return {
        productionTitle: "Producción del período",
        narrativePrefix: "Durante los últimos 7 días",
        periodLabel: "Últimos 7 días",
        scopeNoun: "período",
      }
    case "last_30_days":
      return {
        productionTitle: "Producción del período",
        narrativePrefix: "Durante los últimos 30 días",
        periodLabel: "Últimos 30 días",
        scopeNoun: "período",
      }
    case "this_month":
      return {
        productionTitle: "Producción mensual",
        narrativePrefix: "Durante el mes",
        periodLabel: "Este mes",
        scopeNoun: "mes",
      }
    case "last_month":
      return {
        productionTitle: "Producción mensual",
        narrativePrefix: "Durante el mes anterior",
        periodLabel: "Mes anterior",
        scopeNoun: "mes",
      }
    case "custom": {
      const sameDay = range.dateFromInput === range.dateToInput
      if (sameDay) {
        return {
          productionTitle: "Producción del día",
          narrativePrefix: "Durante el día",
          periodLabel: range.dateFromInput,
          scopeNoun: "día",
        }
      }
      return {
        productionTitle: "Producción del período",
        narrativePrefix: "Durante el período",
        periodLabel: `${range.dateFromInput} → ${range.dateToInput}`,
        scopeNoun: "período",
      }
    }
    default:
      return {
        productionTitle: "Producción del día",
        narrativePrefix: "Durante el día",
        periodLabel: "Hoy",
        scopeNoun: "día",
      }
  }
}

const DEFAULT_PERIOD: DayActivityPeriodSelection = { preset: "today" }

const OFFICIAL_PRESETS = new Set(
  ANALYSIS_DATE_RANGE_PRESET_OPTIONS.map((option) => option.value)
)

function migrateLegacyPreset(raw: string): DayActivityPeriodPreset | null {
  switch (raw) {
    case "today":
    case "yesterday":
    case "this_month":
    case "last_month":
    case "custom":
      return raw
    case "this_week":
    case "last_week":
      return "last_7_days"
    default:
      return null
  }
}

function parsePeriodSelection(raw: string | null): DayActivityPeriodSelection {
  if (!raw) return DEFAULT_PERIOD
  try {
    const parsed = JSON.parse(raw) as DayActivityPeriodSelection & {
      preset: string
    }
    if (!parsed || typeof parsed !== "object") return DEFAULT_PERIOD

    const preset =
      (OFFICIAL_PRESETS.has(parsed.preset as AnalysisDateRangePreset)
        ? (parsed.preset as AnalysisDateRangePreset)
        : migrateLegacyPreset(parsed.preset)) ?? "today"

    return {
      preset,
      customFrom: parsed.customFrom,
      customTo: parsed.customTo,
    }
  } catch {
    return DEFAULT_PERIOD
  }
}

export function loadDayActivityPeriodSelection(): DayActivityPeriodSelection {
  if (typeof window === "undefined") return DEFAULT_PERIOD
  const current = window.localStorage.getItem(STORAGE_KEY)
  if (current) return parsePeriodSelection(current)
  return parsePeriodSelection(window.localStorage.getItem(LEGACY_STORAGE_KEY))
}

let periodStoreSnapshot: DayActivityPeriodSelection = DEFAULT_PERIOD
const periodStoreListeners = new Set<() => void>()

if (typeof window !== "undefined") {
  periodStoreSnapshot = loadDayActivityPeriodSelection()
}

function notifyPeriodStoreListeners() {
  for (const listener of periodStoreListeners) listener()
}

export function subscribeDayActivityPeriodStore(listener: () => void): () => void {
  periodStoreListeners.add(listener)
  return () => {
    periodStoreListeners.delete(listener)
  }
}

export function getDayActivityPeriodStoreSnapshot(): DayActivityPeriodSelection {
  return periodStoreSnapshot
}

export function getDayActivityPeriodStoreServerSnapshot(): DayActivityPeriodSelection {
  return DEFAULT_PERIOD
}

export function saveDayActivityPeriodSelection(
  selection: DayActivityPeriodSelection
): void {
  periodStoreSnapshot = selection
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection))
    } catch {
      // ignore quota / private mode
    }
  }
  notifyPeriodStoreListeners()
}

export function dayActivitySelectionFromAnalysisRange(
  range: AnalysisDateRangeValue
): DayActivityPeriodSelection {
  if (range.preset === "custom") {
    return {
      preset: "custom",
      customFrom: range.dateFrom,
      customTo: range.dateTo,
    }
  }
  return { preset: range.preset }
}

export function dayActivitySelectionAsAnalysisRange(
  selection: DayActivityPeriodSelection
): AnalysisDateRangeValue {
  try {
    return resolveAnalysisDateRange({
      preset: selection.preset,
      dateFrom: selection.customFrom,
      dateTo: selection.customTo,
    })
  } catch {
    return createDefaultAnalysisDateRange()
  }
}
