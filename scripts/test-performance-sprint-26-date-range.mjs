import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  analysisDateRangeFocusDate,
  createDefaultAnalysisDateRange,
  formatAnalysisDateRangeTriggerLabel,
  resolveAnalysisDateRange,
} from "../lib/analysis/date-range/index.ts"
import { resolveCrewsPeriodRange } from "../lib/analysis/crews/period.ts"
import { analysisQueryKeys } from "../lib/analysis/react-query/keys.ts"
import {
  analysisDateRangeToReportFilters,
  reportFiltersToAnalysisDateRange,
} from "../lib/analysis/date-range/report-bridge.ts"

const ROOT = process.cwd()

const REF = "2026-08-15"

test("Sprint 26: all presets resolve consistently (local dates)", () => {
  const cases = [
    ["today", "2026-08-15", "2026-08-15"],
    ["yesterday", "2026-08-14", "2026-08-14"],
    ["last_7_days", "2026-08-09", "2026-08-15"],
    ["last_30_days", "2026-07-17", "2026-08-15"],
    ["this_month", "2026-08-01", "2026-08-31"],
    ["last_month", "2026-07-01", "2026-07-31"],
  ]

  for (const [preset, from, to] of cases) {
    const range = resolveAnalysisDateRange({
      preset,
      referenceDate: REF,
    })
    assert.equal(range.preset, preset)
    assert.equal(range.dateFrom, from, preset)
    assert.equal(range.dateTo, to, preset)
  }

  const custom = resolveAnalysisDateRange({
    preset: "custom",
    dateFrom: "2026-07-01",
    dateTo: "2026-07-31",
  })
  assert.equal(custom.dateFrom, "2026-07-01")
  assert.equal(custom.dateTo, "2026-07-31")
})

test("Sprint 26: custom without dates throws (no silent empty range)", () => {
  assert.throws(
    () => resolveAnalysisDateRange({ preset: "custom" }),
    /personalizado/
  )
})

test("Sprint 26: custom orders inverted dates", () => {
  const range = resolveAnalysisDateRange({
    preset: "custom",
    dateFrom: "2026-08-18",
    dateTo: "2026-08-10",
  })
  assert.equal(range.dateFrom, "2026-08-10")
  assert.equal(range.dateTo, "2026-08-18")
})

test("Sprint 26: applied custom trigger shows range, not Personalizado", () => {
  const range = resolveAnalysisDateRange({
    preset: "custom",
    dateFrom: "2026-07-01",
    dateTo: "2026-07-31",
  })
  const label = formatAnalysisDateRangeTriggerLabel(range, "2026-08-15")
  assert.equal(label, "01 Jul → 31 Jul")
  assert.equal(label.includes("Personalizado"), false)

  const toToday = resolveAnalysisDateRange({
    preset: "custom",
    dateFrom: "2026-07-15",
    dateTo: "2026-08-15",
  })
  assert.equal(
    formatAnalysisDateRangeTriggerLabel(toToday, "2026-08-15"),
    "15 Jul → Hoy"
  )
})

test("Sprint 26: preset labels render correctly", () => {
  const today = resolveAnalysisDateRange({
    preset: "today",
    referenceDate: REF,
  })
  assert.equal(
    formatAnalysisDateRangeTriggerLabel(today, REF),
    "Hoy"
  )
})

test("Sprint 26: period change produces distinct QueryKeys", () => {
  const a = resolveCrewsPeriodRange({
    preset: "today",
    referenceDate: REF,
  })
  const b = resolveCrewsPeriodRange({
    preset: "yesterday",
    referenceDate: REF,
  })
  const c = resolveCrewsPeriodRange({
    preset: "custom",
    dateFrom: "2026-07-01",
    dateTo: "2026-07-31",
  })

  const keyA = analysisQueryKeys.cuadrillas(a.preset, a.dateFrom, a.dateTo)
  const keyB = analysisQueryKeys.cuadrillas(b.preset, b.dateFrom, b.dateTo)
  const keyC = analysisQueryKeys.cuadrillas(c.preset, c.dateFrom, c.dateTo)

  assert.notDeepEqual(keyA, keyB)
  assert.notDeepEqual(keyA, keyC)
  assert.notDeepEqual(keyB, keyC)

  assert.deepEqual(keyA, [
    "analysis",
    "cuadrillas",
    "today",
    "2026-08-15",
    "2026-08-15",
  ])
})

test("Sprint 26: focus date is inclusive end of range", () => {
  const range = resolveAnalysisDateRange({
    preset: "last_7_days",
    referenceDate: REF,
  })
  assert.equal(analysisDateRangeFocusDate(range), "2026-08-15")
})

test("Sprint 26: report bridge applies concrete dates (never empty custom)", () => {
  const range = resolveAnalysisDateRange({
    preset: "last_7_days",
    referenceDate: REF,
  })
  const filters = analysisDateRangeToReportFilters(range, {
    period: "month",
  })
  assert.equal(filters.period, "custom")
  assert.equal(filters.startDate, "2026-08-09")
  assert.equal(filters.endDate, "2026-08-15")

  const roundTrip = reportFiltersToAnalysisDateRange(filters)
  assert.equal(roundTrip.dateFrom, "2026-08-09")
  assert.equal(roundTrip.dateTo, "2026-08-15")
})

test("Sprint 26: default range is today", () => {
  const value = createDefaultAnalysisDateRange(REF)
  assert.equal(value.preset, "today")
  assert.equal(value.dateFrom, REF)
  assert.equal(value.dateTo, REF)
})

test("Sprint 26: AnalysisDateRangePicker is the single official component", () => {
  const picker = readFileSync(
    join(ROOT, "lib/analysis/components/analysis-date-range-picker.tsx"),
    "utf8"
  )
  assert.ok(picker.includes("Aplicar"))
  assert.ok(picker.includes("Cancelar"))
  assert.ok(picker.toLowerCase().includes("personalizado"))
  assert.ok(picker.includes("onChange("))
  // Custom must not apply until Aplicar — selecting custom only opens dialog.
  assert.ok(picker.includes('if (preset === "custom")'))
  assert.ok(picker.includes("setCustomOpen(true)"))

  const consumers = [
    "components/activity/crews-module.tsx",
    "components/activity/day-activity-module.tsx",
    "components/activity/executive-center-module.tsx",
    "components/activity/workforce-monitor-module.tsx",
    "components/activity/operations-intelligence-module.tsx",
    "components/reportes/reports-filters.tsx",
  ]

  for (const relative of consumers) {
    const source = readFileSync(join(ROOT, relative), "utf8")
    assert.ok(
      source.includes("AnalysisDateRangePicker"),
      `${relative} must use AnalysisDateRangePicker`
    )
    assert.equal(
      source.includes("Período personalizado"),
      false,
      `${relative} must not keep the old inline custom period UI label`
    )
  }
})

test("Sprint 26: Cuadrillas filters OT by due_date + resolved range in query", () => {
  const sources = readFileSync(
    join(ROOT, "lib/analysis/crews/load-sources.server.ts"),
    "utf8"
  )
  assert.ok(sources.includes('.gte("due_date"'))
  assert.ok(sources.includes('.lte("due_date"'))

  const query = readFileSync(
    join(ROOT, "lib/analysis/react-query/use-crews-query.ts"),
    "utf8"
  )
  assert.ok(query.includes("resolveCrewsPeriodRange"))
  assert.ok(query.includes("resolved.dateFrom"))
  assert.ok(query.includes("resolved.dateTo"))
})

test("Sprint 26: cancel custom does not call onChange (dialog draft only)", () => {
  const picker = readFileSync(
    join(ROOT, "lib/analysis/components/analysis-date-range-picker.tsx"),
    "utf8"
  )
  assert.ok(picker.includes("function cancelCustom"))
  assert.ok(picker.includes("setCustomOpen(false)"))
  // cancelCustom must not invoke onChange
  const cancelBlock = picker.slice(
    picker.indexOf("function cancelCustom"),
    picker.indexOf("function applyCustom")
  )
  assert.equal(cancelBlock.includes("onChange"), false)
})
