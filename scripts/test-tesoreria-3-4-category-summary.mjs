/**
 * Sprint Tesorería 3.4 — resumen por categoría y KPIs clickeables.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  applyTreasuryHistoryFilter,
  buildTreasuryCategorySummary,
  formatTreasuryHistoryFilterBanner,
  resolveTreasuryHistoryFilterSelection,
  sumTreasuryCategorySummary,
  TREASURY_HISTORY_FILTER_NONE,
} from "../lib/tesoreria/history-filter.ts"
import { TREASURY_OT_RENDITION_STATUSES } from "../lib/tesoreria/ot-rendition-status.ts"
import { buildOtRenditionKpi } from "../lib/tesoreria/ot-renditions.ts"
import { buildTreasuryDashboardSummary } from "../lib/tesoreria/summary.ts"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

function movement(overrides) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    companyId: "co",
    movementType: overrides.movementType ?? "income",
    origin: overrides.origin ?? "manual",
    category: overrides.category ?? "otro",
    amount: overrides.amount,
    movementDate: overrides.movementDate ?? "2026-08-18",
    employeeId: null,
    employeeName: null,
    registeredBy: null,
    registeredByName: null,
    status: overrides.status ?? "confirmed",
    notes: overrides.notes ?? "",
    receiptUrl: null,
    cashboxId: null,
    metadata: overrides.metadata ?? {},
    createdAt: "2026-08-18T12:00:00.000Z",
    updatedAt: "2026-08-18T12:00:00.000Z",
    deletedAt: overrides.deletedAt ?? null,
  }
}

const reference = new Date(2026, 7, 18, 16, 0, 0)

const fixture = [
  movement({
    category: "servicios",
    amount: 150000,
    movementDate: "2026-08-18",
  }),
  movement({
    movementType: "expense",
    category: "combustible",
    amount: 100000,
    movementDate: "2026-08-18",
    metadata: { paymentMethod: "efectivo" },
  }),
  movement({
    movementType: "expense",
    category: "repuestos",
    amount: 24000,
    movementDate: "2026-08-18",
  }),
  movement({
    movementType: "withdrawal",
    category: "retiro",
    amount: 20000,
    movementDate: "2026-08-18",
  }),
  movement({
    origin: "task",
    category: "cobranza",
    amount: 19999,
    movementDate: "2026-08-17",
    metadata: { paymentMethodReceived: "efectivo" },
  }),
  movement({
    movementType: "expense",
    category: "combustible",
    amount: 350000,
    movementDate: "2026-08-10",
  }),
  movement({
    origin: "manual",
    category: "otro",
    amount: 636000,
    movementDate: "2026-08-01",
  }),
  movement({
    movementType: "expense",
    category: "materiales",
    amount: 10000,
    movementDate: "2026-07-31",
  }),
  movement({
    movementType: "expense",
    category: "combustible",
    amount: 999999,
    movementDate: "2026-08-18",
    status: "cancelled",
  }),
  movement({
    movementType: "expense",
    category: "combustible",
    amount: 888888,
    movementDate: "2026-08-18",
    deletedAt: "2026-08-18T18:00:00.000Z",
  }),
  movement({
    category: "otro",
    amount: 5000,
    movementDate: "2026-08-18",
    status: "pending",
  }),
]

function byCategory(rows, category) {
  return rows.find((row) => row.category === category)
}

test("A) category summary for Hoy", () => {
  const rows = buildTreasuryCategorySummary(fixture, "today", reference)
  assert.equal(byCategory(rows, "servicios")?.income, 150000)
  assert.equal(byCategory(rows, "servicios")?.expense, 0)
  assert.equal(byCategory(rows, "combustible")?.expense, 100000)
  assert.equal(byCategory(rows, "repuestos")?.expense, 24000)
  assert.equal(byCategory(rows, "cobranza"), undefined)
  assert.equal(byCategory(rows, "otro"), undefined)
})

test("B) category summary for Semana", () => {
  const rows = buildTreasuryCategorySummary(fixture, "week", reference)
  assert.equal(byCategory(rows, "cobranza")?.income, 19999)
  assert.equal(byCategory(rows, "servicios")?.income, 150000)
  assert.equal(byCategory(rows, "combustible")?.expense, 100000)
  assert.equal(byCategory(rows, "otro"), undefined)
})

test("C) category summary for Mes", () => {
  const rows = buildTreasuryCategorySummary(fixture, "month", reference)
  assert.equal(byCategory(rows, "otro")?.income, 636000)
  assert.equal(byCategory(rows, "combustible")?.expense, 450000)
  assert.equal(byCategory(rows, "materiales"), undefined)
  assert.equal(rows[0].category, "otro")
})

test("D) category summary for Todo", () => {
  const rows = buildTreasuryCategorySummary(fixture, "all", reference)
  assert.equal(byCategory(rows, "materiales")?.expense, 10000)
  assert.equal(byCategory(rows, "combustible")?.expense, 450000)
})

test("E) expense-only category shows $0 income", () => {
  const rows = buildTreasuryCategorySummary(fixture, "today", reference)
  const combustible = byCategory(rows, "combustible")
  assert.equal(combustible?.income, 0)
  assert.equal(combustible?.expense, 100000)
  assert.equal(combustible?.label, "Combustible")
})

test("F) income-only category shows $0 expense", () => {
  const rows = buildTreasuryCategorySummary(fixture, "today", reference)
  const servicios = byCategory(rows, "servicios")
  assert.equal(servicios?.income, 150000)
  assert.equal(servicios?.expense, 0)
})

test("G) category present in both income and expense", () => {
  const rows = buildTreasuryCategorySummary(
    [
      movement({ category: "otro", amount: 636000 }),
      movement({
        movementType: "expense",
        category: "otro",
        amount: 50000,
      }),
    ],
    "today",
    reference
  )
  const otro = byCategory(rows, "otro")
  assert.equal(otro?.income, 636000)
  assert.equal(otro?.expense, 50000)
  assert.equal(otro?.net, 586000)
})

test("H) net equals income minus expense", () => {
  const rows = buildTreasuryCategorySummary(fixture, "month", reference)
  for (const row of rows) {
    assert.equal(row.net, row.income - row.expense)
  }
})

test("I) withdrawals do not appear as categories", () => {
  const rows = buildTreasuryCategorySummary(fixture, "today", reference)
  assert.equal(byCategory(rows, "retiro"), undefined)
  assert.ok(rows.every((row) => row.category !== "retiro"))
})

test("J) selected category filters Historial for the current period", () => {
  const rows = applyTreasuryHistoryFilter(
    fixture,
    { type: "category", category: "combustible" },
    "month",
    reference
  )
  assert.equal(rows.length, 2)
  assert.ok(rows.every((item) => item.category === "combustible"))
  assert.ok(rows.every((item) => item.status === "confirmed"))
  assert.equal(
    rows.reduce((sum, item) => sum + item.amount, 0),
    450000
  )
  assert.equal(
    formatTreasuryHistoryFilterBanner(
      { type: "category", category: "combustible" },
      "month"
    ),
    "Mostrando: Combustible · Mes"
  )
})

test("K) changing period keeps the category filter and updates rows", () => {
  const filter = { type: "category", category: "combustible" }
  const today = applyTreasuryHistoryFilter(fixture, filter, "today", reference)
  const month = applyTreasuryHistoryFilter(fixture, filter, "month", reference)
  assert.equal(today.length, 1)
  assert.equal(today[0].amount, 100000)
  assert.equal(month.length, 2)
  assert.equal(
    formatTreasuryHistoryFilterBanner(filter, "today"),
    "Mostrando: Combustible · Hoy"
  )
  assert.equal(
    formatTreasuryHistoryFilterBanner(filter, "month"),
    "Mostrando: Combustible · Mes"
  )
})

test("L) selecting a KPI replaces the category filter", () => {
  const next = resolveTreasuryHistoryFilterSelection(
    { type: "category", category: "combustible" },
    { type: "paymentMethod", key: "efectivo" },
    "toggle"
  )
  assert.deepEqual(next, { type: "paymentMethod", key: "efectivo" })
  assert.equal(
    formatTreasuryHistoryFilterBanner(next, "month"),
    "Mostrando: Efectivo · Mes"
  )
})

test("M) selecting a category replaces the KPI filter", () => {
  const next = resolveTreasuryHistoryFilterSelection(
    { type: "paymentMethod", key: "efectivo" },
    { type: "category", category: "combustible" },
    "replace"
  )
  assert.deepEqual(next, { type: "category", category: "combustible" })
})

test("N) cancelled and deleted movements do not appear", () => {
  const rows = buildTreasuryCategorySummary(fixture, "today", reference)
  assert.equal(byCategory(rows, "combustible")?.expense, 100000)

  const filtered = applyTreasuryHistoryFilter(
    fixture,
    { type: "category", category: "combustible" },
    "today",
    reference
  )
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].amount, 100000)
  assert.equal(filtered[0].status, "confirmed")
  assert.equal(filtered[0].deletedAt, null)
})

test("O) pending OT renditions are not confirmed income", () => {
  const pending = buildOtRenditionKpi([
    { status: TREASURY_OT_RENDITION_STATUSES.PENDING, amount: 349999 },
  ])
  const rows = buildTreasuryCategorySummary(fixture, "today", reference)
  const totals = sumTreasuryCategorySummary(rows)
  const summary = buildTreasuryDashboardSummary(fixture, reference, "today")

  assert.equal(pending.totalAmount, 349999)
  assert.equal(totals.income, summary.income)
  assert.notEqual(totals.income, 349999)
  assert.ok(totals.income < 349999)
})

test("P) category totals match Ingresos and Egresos KPIs", () => {
  for (const range of ["today", "week", "month", "all"]) {
    const rows = buildTreasuryCategorySummary(fixture, range, reference)
    const totals = sumTreasuryCategorySummary(rows)
    const summary = buildTreasuryDashboardSummary(fixture, reference, range)
    assert.equal(totals.income, summary.income)
    assert.equal(totals.expense, summary.expense)
  }
})

test("clickable KPIs filter Historial with a single active filter", () => {
  const ingresos = applyTreasuryHistoryFilter(
    fixture,
    { type: "income" },
    "today",
    reference
  )
  assert.ok(ingresos.every((item) => item.movementType === "income"))
  assert.ok(ingresos.every((item) => item.status === "confirmed"))

  const saldo = applyTreasuryHistoryFilter(
    fixture,
    { type: "periodBalance" },
    "today",
    reference
  )
  assert.equal(
    saldo.length,
    ingresos.length +
      applyTreasuryHistoryFilter(fixture, { type: "expense" }, "today", reference)
        .length +
      applyTreasuryHistoryFilter(
        fixture,
        { type: "withdrawal" },
        "today",
        reference
      ).length
  )
  assert.ok(!saldo.some((item) => item.status === "pending"))

  const cashToday = applyTreasuryHistoryFilter(
    fixture,
    { type: "cashInBox" },
    "today",
    reference
  )
  const cashWeek = applyTreasuryHistoryFilter(
    fixture,
    { type: "cashInBox" },
    "week",
    reference
  )
  assert.deepEqual(
    cashToday.map((item) => item.id).sort(),
    cashWeek.map((item) => item.id).sort()
  )
  assert.ok(
    cashToday.some(
      (item) =>
        item.movementType === "income" && item.movementDate === "2026-08-17"
    )
  )

  const efectivo = applyTreasuryHistoryFilter(
    fixture,
    { type: "paymentMethod", key: "efectivo" },
    "month",
    reference
  )
  assert.ok(efectivo.every((item) => item.movementType === "income"))
  assert.equal(efectivo.reduce((sum, item) => sum + item.amount, 0), 19999)

  const sameKpiClears = resolveTreasuryHistoryFilterSelection(
    { type: "income" },
    { type: "income" },
    "toggle"
  )
  assert.deepEqual(sameKpiClears, TREASURY_HISTORY_FILTER_NONE)
})

test("UI: category summary button, dialog, filter banner and clickable KPIs", () => {
  const module = read("components/tesoreria/treasury-module.tsx")
  assert.match(module, /Resumen por Categoría/)
  assert.match(module, /TreasuryCategorySummaryDialog/)
  assert.match(module, /Registrar Ingreso/)
  assert.match(module, /Registrar Egreso/)
  assert.match(module, /Registrar Retiro/)

  const dialog = read(
    "components/tesoreria/treasury-category-summary-dialog.tsx"
  )
  assert.match(dialog, /Resumen por Categoría/)
  assert.match(dialog, /Movimientos del período seleccionado/)
  assert.match(dialog, />Ingresos</)
  assert.match(dialog, />Egresos</)
  assert.match(dialog, />Neto</)
  assert.match(dialog, />\s*Cerrar\s*</)
  assert.match(dialog, /selectHistoryFilter/)
  assert.match(dialog, /hover:bg-muted/)
  assert.doesNotMatch(dialog, /TreasuryPeriodToggle/)

  const history = read("components/tesoreria/treasury-movements-history.tsx")
  assert.match(history, /TreasuryHistoryFilterBanner/)
  assert.match(history, /applyTreasuryHistoryFilter/)
  assert.match(history, /<TableHead>Fecha<\/TableHead>/)
  assert.match(history, /<TableHead>Acciones<\/TableHead>/)

  const banner = read(
    "components/tesoreria/treasury-history-filter-banner.tsx"
  )
  assert.match(banner, /Limpiar filtro/)
  assert.match(banner, /formatTreasuryHistoryFilterBanner/)

  const filterSource = read("lib/tesoreria/history-filter.ts")
  assert.match(filterSource, /Mostrando:/)

  const cards = read("components/tesoreria/treasury-summary-cards.tsx")
  assert.match(cards, /toggleHistoryFilter\(\{ type: "income" \}\)/)
  assert.match(cards, /toggleHistoryFilter\(\{ type: "periodBalance" \}\)/)
  assert.match(cards, /toggleHistoryFilter\(\{ type: "cashInBox" \}\)/)
  assert.doesNotMatch(cards, /\bdisabled\b/)

  const secondary = read(
    "components/tesoreria/treasury-payment-method-kpis.tsx"
  )
  assert.match(secondary, /type: "paymentMethod"/)
})
