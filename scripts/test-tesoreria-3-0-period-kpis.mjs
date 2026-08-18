/**
 * Sprint Tesorería 3.0 — KPIs del período + composición por medio.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  buildTreasuryIncomeCompositionKpis,
  sumTreasuryPaymentMethodKpis,
} from "../lib/tesoreria/ot-rendition-payment-kpis.ts"
import {
  buildTreasuryDashboardSummary,
  TREASURY_HISTORY_RANGE_OPTIONS,
} from "../lib/tesoreria/summary.ts"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

function movement(overrides) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    companyId: "co",
    movementType: overrides.movementType ?? "income",
    origin: overrides.origin ?? "task",
    category: overrides.category ?? "cobranza",
    amount: overrides.amount,
    movementDate: overrides.movementDate,
    employeeId: null,
    employeeName: null,
    registeredBy: null,
    registeredByName: null,
    status: overrides.status ?? "confirmed",
    notes: "",
    receiptUrl: null,
    cashboxId: null,
    metadata: overrides.metadata ?? {},
    createdAt: "2026-08-18T12:00:00.000Z",
    updatedAt: "2026-08-18T12:00:00.000Z",
    deletedAt: null,
  }
}

function otIncome(amount, received, day) {
  return movement({
    movementType: "income",
    amount,
    movementDate: day,
    metadata: {
      source: "ot_rendition",
      paymentMethodReceived: received,
    },
  })
}

test("period options are Hoy / Semana / Mes / Todo without custom", () => {
  assert.deepEqual(
    TREASURY_HISTORY_RANGE_OPTIONS.map((item) => item.value),
    ["today", "week", "month", "all"]
  )
  const types = read("lib/types/tesoreria.ts")
  assert.doesNotMatch(types, /custom/)
})

test("Saldo del Período is ingresos − egresos − retiros of the same range", () => {
  const reference = new Date(2026, 7, 18, 15, 0, 0)
  const summary = buildTreasuryDashboardSummary(
    [
      otIncome(250000, "efectivo", "2026-08-18"),
      otIncome(700000, "transferencia", "2026-08-18"),
      otIncome(150000, "mercadopago", "2026-08-18"),
      otIncome(100000, "debito", "2026-08-10"),
      movement({
        movementType: "expense",
        amount: 40000,
        movementDate: "2026-08-18",
      }),
      movement({
        movementType: "withdrawal",
        amount: 30000,
        movementDate: "2026-08-18",
      }),
    ],
    reference,
    "today"
  )

  assert.equal(summary.income, 1100000)
  assert.equal(summary.expense, 40000)
  assert.equal(summary.withdrawalPeriod, 30000)
  assert.equal(summary.currentBalance, 1030000)
})

test("composition uses the same period as Ingresos and is not added into saldo", () => {
  const reference = new Date(2026, 7, 18, 15, 0, 0)
  const movements = [
    otIncome(250000, "efectivo", "2026-08-18"),
    otIncome(700000, "transferencia", "2026-08-18"),
    otIncome(150000, "mercadopago", "2026-08-18"),
    otIncome(100000, "credito", "2026-08-10"),
  ]

  const todaySummary = buildTreasuryDashboardSummary(
    movements,
    reference,
    "today"
  )
  const todayComposition = buildTreasuryIncomeCompositionKpis(
    movements,
    "today",
    reference
  )
  assert.equal(todaySummary.income, 1100000)
  assert.equal(todaySummary.currentBalance, 1100000)
  assert.equal(sumTreasuryPaymentMethodKpis(todayComposition), 1100000)
  assert.equal(
    todayComposition.find((item) => item.key === "tarjetas")?.amount,
    0
  )

  const monthSummary = buildTreasuryDashboardSummary(
    movements,
    reference,
    "month"
  )
  const monthComposition = buildTreasuryIncomeCompositionKpis(
    movements,
    "month",
    reference
  )
  assert.equal(monthSummary.income, 1200000)
  assert.equal(monthSummary.currentBalance, 1200000)
  assert.equal(
    monthComposition.find((item) => item.key === "tarjetas")?.amount,
    100000
  )
  assert.equal(sumTreasuryPaymentMethodKpis(monthComposition), 1200000)
})

test("week range includes Monday through selected day; all includes prior months", () => {
  const reference = new Date(2026, 7, 18, 15, 0, 0)
  const movements = [
    otIncome(100, "efectivo", "2026-08-17"),
    otIncome(200, "transferencia", "2026-08-18"),
    otIncome(300, "mercadopago", "2026-08-10"),
    otIncome(400, "cheque", "2026-07-31"),
  ]

  const week = buildTreasuryIncomeCompositionKpis(movements, "week", reference)
  assert.equal(week.find((item) => item.key === "efectivo")?.amount, 100)
  assert.equal(week.find((item) => item.key === "transferencia")?.amount, 200)
  assert.equal(week.find((item) => item.key === "mercadopago")?.amount, 0)
  assert.equal(week.find((item) => item.key === "cheque")?.amount, 0)

  const all = buildTreasuryIncomeCompositionKpis(movements, "all", reference)
  assert.equal(all.find((item) => item.key === "mercadopago")?.amount, 300)
  assert.equal(all.find((item) => item.key === "cheque")?.amount, 400)
  assert.equal(all.length, 6)
})

test("UI shares the period, drops caja física, and always shows six gray methods", () => {
  const provider = read("components/tesoreria/treasury-provider.tsx")
  assert.match(provider, /historyRange/)
  assert.match(provider, /setHistoryRange/)

  const cards = read("components/tesoreria/treasury-summary-cards.tsx")
  assert.match(cards, /TreasuryPeriodToggle/)
  assert.match(cards, /historyRange/)
  assert.match(cards, /label="Ingresos"/)
  assert.match(cards, /label="Egresos"/)
  assert.match(cards, /Retiros del Período/)
  assert.match(cards, /Saldo del Período/)
  assert.doesNotMatch(cards, /Caja física disponible/)
  assert.doesNotMatch(cards, /Saldo Actual/)
  assert.doesNotMatch(cards, /Ingresos del Día/)

  const history = read("components/tesoreria/treasury-movements-history.tsx")
  assert.match(history, /historyRange/)
  assert.match(history, /TreasuryPeriodToggle/)

  const secondary = read(
    "components/tesoreria/treasury-payment-method-kpis.tsx"
  )
  assert.match(secondary, /Composición de la cobranza/)
  assert.match(secondary, /historyRange/)
  assert.match(secondary, /buildTreasuryIncomeCompositionKpis/)
  assert.match(secondary, /tone="gray"/)
  assert.match(secondary, /xl:grid-cols-6/)
  assert.doesNotMatch(secondary, /onClick|href=/)
  assert.doesNotMatch(secondary, /items\.length === 0/)

  const kpis = read("lib/tesoreria/ot-rendition-payment-kpis.ts")
  assert.match(kpis, /paymentMethodReceived/)
  assert.doesNotMatch(kpis, /paymentMethodExpected/)
  assert.doesNotMatch(kpis, /if \(amount <= 0\) return \[\]/)
})
