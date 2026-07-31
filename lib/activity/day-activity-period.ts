/**
 * UX period presets for Actividad de la Jornada.
 * Maps to dateFrom/dateTo for existing timeline fetch — no new engines.
 */

import { todayDateInputValue } from "@/lib/activity/employee-daily-report"

export type DayActivityPeriodPreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "custom"

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
  /** e.g. Producción del día */
  productionTitle: string
  /** e.g. Durante el día */
  narrativePrefix: string
  /** Short label for panel */
  periodLabel: string
  /** Scope wording: día | semana | mes | período */
  scopeNoun: "día" | "semana" | "mes" | "período"
}

const STORAGE_KEY = "bespoke.activity.jornada.period.v1"

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

function toInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Monday-based week start. */
function startOfWeek(date: Date): Date {
  const day = startOfLocalDay(date)
  const weekday = day.getDay()
  const fromMonday = weekday === 0 ? 6 : weekday - 1
  day.setDate(day.getDate() - fromMonday)
  return day
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

export const DAY_ACTIVITY_PERIOD_OPTIONS: ReadonlyArray<{
  value: DayActivityPeriodPreset
  label: string
}> = [
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "this_week", label: "Esta semana" },
  { value: "last_week", label: "Semana pasada" },
  { value: "this_month", label: "Este mes" },
  { value: "last_month", label: "Mes pasado" },
  { value: "custom", label: "Personalizado" },
]

export function resolveDayActivityPeriodRange(
  selection: DayActivityPeriodSelection,
  now: Date = new Date()
): DayActivityPeriodRange {
  const today = startOfLocalDay(now)

  switch (selection.preset) {
    case "today":
      return { dateFromInput: toInput(today), dateToInput: toInput(today) }
    case "yesterday": {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      return {
        dateFromInput: toInput(yesterday),
        dateToInput: toInput(yesterday),
      }
    }
    case "this_week":
      return {
        dateFromInput: toInput(startOfWeek(today)),
        dateToInput: toInput(today),
      }
    case "last_week": {
      const thisWeekStart = startOfWeek(today)
      const lastWeekEnd = new Date(thisWeekStart)
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 1)
      const lastWeekStart = startOfWeek(lastWeekEnd)
      return {
        dateFromInput: toInput(lastWeekStart),
        dateToInput: toInput(lastWeekEnd),
      }
    }
    case "this_month":
      return {
        dateFromInput: toInput(startOfMonth(today)),
        dateToInput: toInput(today),
      }
    case "last_month": {
      const firstThisMonth = startOfMonth(today)
      const lastMonthEnd = new Date(firstThisMonth)
      lastMonthEnd.setDate(lastMonthEnd.getDate() - 1)
      return {
        dateFromInput: toInput(startOfMonth(lastMonthEnd)),
        dateToInput: toInput(endOfMonth(lastMonthEnd)),
      }
    }
    case "custom": {
      const from =
        selection.customFrom?.trim() ||
        selection.customTo?.trim() ||
        todayDateInputValue(now)
      const to =
        selection.customTo?.trim() ||
        selection.customFrom?.trim() ||
        todayDateInputValue(now)
      return from <= to
        ? { dateFromInput: from, dateToInput: to }
        : { dateFromInput: to, dateToInput: from }
    }
    default:
      return { dateFromInput: toInput(today), dateToInput: toInput(today) }
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
    case "this_week":
    case "last_week":
      return {
        productionTitle: "Producción semanal",
        narrativePrefix: "Durante la semana",
        periodLabel:
          selection.preset === "this_week" ? "Esta semana" : "Semana pasada",
        scopeNoun: "semana",
      }
    case "this_month":
    case "last_month":
      return {
        productionTitle: "Producción mensual",
        narrativePrefix: "Durante el mes",
        periodLabel:
          selection.preset === "this_month" ? "Este mes" : "Mes pasado",
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

function parsePeriodSelection(raw: string | null): DayActivityPeriodSelection {
  if (!raw) return DEFAULT_PERIOD
  try {
    const parsed = JSON.parse(raw) as DayActivityPeriodSelection
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !DAY_ACTIVITY_PERIOD_OPTIONS.some(
        (option) => option.value === parsed.preset
      )
    ) {
      return DEFAULT_PERIOD
    }
    return {
      preset: parsed.preset,
      customFrom: parsed.customFrom,
      customTo: parsed.customTo,
    }
  } catch {
    return DEFAULT_PERIOD
  }
}

export function loadDayActivityPeriodSelection(): DayActivityPeriodSelection {
  if (typeof window === "undefined") return DEFAULT_PERIOD
  return parsePeriodSelection(window.localStorage.getItem(STORAGE_KEY))
}

/** Snapshot for useSyncExternalStore — stable when value unchanged. */
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
