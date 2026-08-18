/**
 * Sprint Tesorería 3.1 — unificar KPIs, período, saldo y composición.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  buildTreasuryIncomeCompositionKpis,
  readTreasuryIncomeReceivedPaymentMethod,
  resolveTreasuryIncomeCompositionBucket,
  sumTreasuryPaymentMethodKpis,
} from "../lib/tesoreria/ot-rendition-payment-kpis.ts"
import { buildOtRenditionKpi } from "../lib/tesoreria/ot-renditions.ts"
import { TREASURY_OT_RENDITION_STATUSES } from "../lib/tesoreria/ot-rendition-status.ts"
import {
  buildTreasuryDashboardSummary,
  filterTreasuryMovementsByRange,
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
    deletedAt: null,
  }
}

const reference = new Date(2026, 7, 18, 16, 0, 0)

const productionMovements = [
  movement({
    movementType: "expense",
    category: "combustible",
    amount: 30000,
    movementDate: "2026-08-18",
  }),
  movement({
    movementType: "expense",
    category: "repuestos",
    amount: 24000,
    movementDate: "2026-08-18",
  }),
  movement({
    origin: "task",
    category: "cobranza",
    amount: 19999,
    movementDate: "2026-08-18",
    metadata: {
      source: "ot_rendition",
      paymentMethodReceived: "efectivo",
    },
  }),
  movement({
    origin: "manual",
    category: "otro",
    amount: 7000,
    movementDate: "2026-08-18",
  }),
  movement({
    origin: "manual",
    category: "otro",
    amount: 5000,
    movementDate: "2026-08-17",
  }),
]

test("A) manual income $7.000 categoría Otro goes to Ingresos and Otros", () => {
  const manual = [
    movement({
      origin: "manual",
      category: "otro",
      amount: 7000,
    }),
  ]
  const summary = buildTreasuryDashboardSummary(manual, reference, "today")
  const composition = buildTreasuryIncomeCompositionKpis(
    manual,
    "today",
    reference
  )

  assert.equal(readTreasuryIncomeReceivedPaymentMethod(manual[0]), null)
  assert.equal(resolveTreasuryIncomeCompositionBucket(manual[0]), "otro")
  assert.equal(summary.income, 7000)
  assert.equal(composition.find((item) => item.key === "otro")?.amount, 7000)
})

test("B) OT cash rendition $19.999 goes to Ingresos and Efectivo", () => {
  const ot = [
    movement({
      origin: "task",
      category: "cobranza",
      amount: 19999,
      metadata: {
        source: "ot_rendition",
        paymentMethodExpected: "transferencia",
        paymentMethodReceived: "efectivo",
      },
    }),
  ]
  const summary = buildTreasuryDashboardSummary(ot, reference, "today")
  const composition = buildTreasuryIncomeCompositionKpis(ot, "today", reference)

  assert.equal(summary.income, 19999)
  assert.equal(
    composition.find((item) => item.key === "efectivo")?.amount,
    19999
  )
  assert.equal(
    composition.find((item) => item.key === "transferencia")?.amount,
    0
  )
})

test("C) production day: Ingresos $26.999, Efectivo $19.999, Otros $7.000", () => {
  const summary = buildTreasuryDashboardSummary(
    productionMovements,
    reference,
    "today"
  )
  const composition = buildTreasuryIncomeCompositionKpis(
    productionMovements,
    "today",
    reference
  )

  assert.equal(summary.income, 26999)
  assert.equal(summary.expense, 54000)
  assert.equal(summary.withdrawalPeriod, 0)
  assert.equal(summary.currentBalance, -27001)
  assert.equal(
    composition.find((item) => item.key === "efectivo")?.amount,
    19999
  )
  assert.equal(composition.find((item) => item.key === "otro")?.amount, 7000)
  assert.equal(sumTreasuryPaymentMethodKpis(composition), summary.income)
  assert.equal(composition.length, 6)
})

test("D) pending OT $349.999 stays in Pendientes only", () => {
  const pending = [
    {
      status: TREASURY_OT_RENDITION_STATUSES.PENDING,
      amount: 349999,
    },
  ]
  const summary = buildTreasuryDashboardSummary(
    productionMovements,
    reference,
    "today"
  )
  const composition = buildTreasuryIncomeCompositionKpis(
    productionMovements,
    "today",
    reference
  )
  const pendingKpi = buildOtRenditionKpi(pending)

  assert.equal(summary.income, 26999)
  assert.equal(summary.currentBalance, -27001)
  assert.equal(sumTreasuryPaymentMethodKpis(composition), 26999)
  assert.equal(pendingKpi.count, 1)
  assert.equal(pendingKpi.totalAmount, 349999)
})

test("E) Hoy → Semana recalculates temporal KPIs and composition; Pendientes stay", () => {
  const today = buildTreasuryDashboardSummary(
    productionMovements,
    reference,
    "today"
  )
  const week = buildTreasuryDashboardSummary(
    productionMovements,
    reference,
    "week"
  )
  const todayComposition = buildTreasuryIncomeCompositionKpis(
    productionMovements,
    "today",
    reference
  )
  const weekComposition = buildTreasuryIncomeCompositionKpis(
    productionMovements,
    "week",
    reference
  )
  const historyToday = filterTreasuryMovementsByRange(
    productionMovements,
    "today",
    reference
  )
  const historyWeek = filterTreasuryMovementsByRange(
    productionMovements,
    "week",
    reference
  )
  const pendingKpi = buildOtRenditionKpi([
    { status: TREASURY_OT_RENDITION_STATUSES.PENDING, amount: 349999 },
  ])

  assert.equal(today.income, 26999)
  assert.equal(week.income, 31999)
  assert.equal(week.currentBalance, -22001)
  assert.equal(sumTreasuryPaymentMethodKpis(todayComposition), today.income)
  assert.equal(sumTreasuryPaymentMethodKpis(weekComposition), week.income)
  assert.equal(
    weekComposition.find((item) => item.key === "otro")?.amount,
    12000
  )
  assert.equal(historyToday.length, 4)
  assert.equal(historyWeek.length, 5)
  assert.equal(pendingKpi.totalAmount, 349999)

  const pendingKpiSource = read(
    "components/tesoreria/treasury-pending-rendition-kpi.tsx"
  )
  assert.doesNotMatch(pendingKpiSource, /historyRange/)
})

test("F) withdrawals reduce Saldo del Período and stay out of Ingresos/composición", () => {
  const withWithdrawal = [
    ...productionMovements,
    movement({
      movementType: "withdrawal",
      category: "retiro",
      amount: 10000,
      movementDate: "2026-08-18",
    }),
  ]
  const summary = buildTreasuryDashboardSummary(
    withWithdrawal,
    reference,
    "today"
  )
  const composition = buildTreasuryIncomeCompositionKpis(
    withWithdrawal,
    "today",
    reference
  )

  assert.equal(summary.income, 26999)
  assert.equal(summary.withdrawalPeriod, 10000)
  assert.equal(summary.currentBalance, -37001)
  assert.equal(sumTreasuryPaymentMethodKpis(composition), 26999)
})

test("composition never reads payment_method_expected and always shows six methods", () => {
  const source = read("lib/tesoreria/ot-rendition-payment-kpis.ts")
  assert.match(source, /paymentMethodReceived/)
  assert.doesNotMatch(source, /paymentMethodExpected/)
  assert.match(source, /buildTreasuryIncomeCompositionKpis/)

  const form = read("components/tesoreria/treasury-movement-form-dialog.tsx")
  assert.doesNotMatch(form, /paymentMethodReceived|payment_method/)

  const cards = read("components/tesoreria/treasury-summary-cards.tsx")
  assert.match(cards, /Saldo del Período/)
  assert.match(cards, /TreasuryPeriodToggle/)
  assert.match(cards, /historyRange/)

  const history = read("components/tesoreria/treasury-movements-history.tsx")
  assert.match(history, /historyRange/)
})
