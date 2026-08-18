/**
 * Sprint Tesorería 3.2 — KPI Dinero en Caja (efectivo acumulado del mes).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  buildTreasuryCashInBoxMonth,
  buildTreasuryIncomeCompositionKpis,
  isTreasuryPhysicalCashIncome,
} from "../lib/tesoreria/ot-rendition-payment-kpis.ts"
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
    category: overrides.category ?? "cobranza",
    amount: overrides.amount,
    movementDate: overrides.movementDate ?? "2026-08-18",
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

const reference = new Date(2026, 7, 18, 16, 0, 0)

test("A) OT cash rendition increases Dinero en Caja", () => {
  const cash = buildTreasuryCashInBoxMonth(
    [
      movement({
        origin: "task",
        amount: 100000,
        metadata: {
          source: "ot_rendition",
          paymentMethodReceived: "efectivo",
        },
      }),
    ],
    reference
  )
  assert.equal(isTreasuryPhysicalCashIncome({
    movementType: "income",
    metadata: { paymentMethodReceived: "efectivo" },
  }), true)
  assert.equal(cash, 100000)
})

test("B) OT transfer rendition does not increase Dinero en Caja", () => {
  const cash = buildTreasuryCashInBoxMonth(
    [
      movement({
        origin: "task",
        amount: 70000,
        metadata: {
          source: "ot_rendition",
          paymentMethodReceived: "transferencia",
        },
      }),
      movement({
        origin: "task",
        amount: 15000,
        metadata: { paymentMethodReceived: "mercadopago" },
      }),
      movement({
        origin: "task",
        amount: 8000,
        metadata: { paymentMethodReceived: "debito" },
      }),
    ],
    reference
  )
  assert.equal(cash, 0)
})

test("C) cash expense reduces Dinero en Caja", () => {
  const cash = buildTreasuryCashInBoxMonth(
    [
      movement({
        origin: "task",
        amount: 100000,
        metadata: { paymentMethodReceived: "efectivo" },
      }),
      movement({
        movementType: "expense",
        category: "combustible",
        amount: 80000,
        metadata: { paymentMethod: "efectivo" },
      }),
    ],
    reference
  )
  assert.equal(cash, 20000)
})

test("D) withdrawal reduces Dinero en Caja", () => {
  const cash = buildTreasuryCashInBoxMonth(
    [
      movement({
        origin: "task",
        amount: 100000,
        metadata: { paymentMethodReceived: "efectivo" },
      }),
      movement({
        movementType: "withdrawal",
        category: "retiro",
        amount: 30000,
      }),
    ],
    reference
  )
  assert.equal(cash, 70000)
})

test("E) pending OT does not change Dinero en Caja", () => {
  const movements = [
    movement({
      origin: "task",
      amount: 100000,
      metadata: { paymentMethodReceived: "efectivo" },
    }),
  ]
  const before = buildTreasuryCashInBoxMonth(movements, reference)
  const after = buildTreasuryCashInBoxMonth(movements, reference)
  const pending = buildOtRenditionKpi([
    { status: TREASURY_OT_RENDITION_STATUSES.PENDING, amount: 349999 },
  ])

  assert.equal(before, 100000)
  assert.equal(after, 100000)
  assert.equal(pending.totalAmount, 349999)
})

test("F) Hoy/Semana/Mes/Todo do not change Dinero en Caja month window", () => {
  const movements = [
    movement({
      origin: "task",
      amount: 200000,
      movementDate: "2026-08-01",
      metadata: { paymentMethodReceived: "efectivo" },
    }),
    movement({
      origin: "task",
      amount: 19999,
      movementDate: "2026-08-18",
      metadata: { paymentMethodReceived: "efectivo" },
    }),
    movement({
      origin: "task",
      amount: 50000,
      movementDate: "2026-07-31",
      metadata: { paymentMethodReceived: "efectivo" },
    }),
  ]

  const cash = buildTreasuryCashInBoxMonth(movements, reference)
  assert.equal(cash, 219999)

  const today = buildTreasuryDashboardSummary(movements, reference, "today")
  const week = buildTreasuryDashboardSummary(movements, reference, "week")
  const month = buildTreasuryDashboardSummary(movements, reference, "month")
  const all = buildTreasuryDashboardSummary(movements, reference, "all")
  assert.equal(today.income, 19999)
  assert.equal(week.income, 19999)
  assert.equal(month.income, 219999)
  assert.equal(all.income, 269999)
  assert.equal(buildTreasuryCashInBoxMonth(movements, reference), cash)

  const cards = read("components/tesoreria/treasury-summary-cards.tsx")
  assert.match(cards, /buildTreasuryCashInBoxMonth\(movements, now\)/)
  assert.doesNotMatch(
    cards,
    /buildTreasuryCashInBoxMonth\(movements, now, historyRange\)/
  )
  assert.match(cards, /historyRange/)
})

test("G) Saldo del Período can be negative while Dinero en Caja stays positive", () => {
  const movements = [
    movement({
      origin: "task",
      amount: 200000,
      movementDate: "2026-08-01",
      metadata: { paymentMethodReceived: "efectivo" },
    }),
    movement({
      origin: "task",
      amount: 100000,
      movementDate: "2026-08-10",
      metadata: { paymentMethodReceived: "efectivo" },
    }),
    movement({
      movementType: "expense",
      category: "combustible",
      amount: 80000,
      movementDate: "2026-08-10",
    }),
    movement({
      movementType: "withdrawal",
      category: "retiro",
      amount: 30000,
      movementDate: "2026-08-10",
    }),
    movement({
      origin: "task",
      amount: 19999,
      movementDate: "2026-08-18",
      metadata: { paymentMethodReceived: "efectivo" },
    }),
    movement({
      origin: "manual",
      category: "otro",
      amount: 7000,
      movementDate: "2026-08-18",
    }),
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
  ]

  const today = buildTreasuryDashboardSummary(movements, reference, "today")
  const cash = buildTreasuryCashInBoxMonth(movements, reference)
  const composition = buildTreasuryIncomeCompositionKpis(
    movements,
    "today",
    reference
  )

  assert.equal(today.income, 26999)
  assert.equal(today.expense, 54000)
  assert.equal(today.withdrawalPeriod, 0)
  assert.equal(today.currentBalance, -27001)
  // Unspecified historical expenses do not reduce Dinero en Caja.
  assert.equal(cash, 289999)
  assert.ok(cash > 0)
  assert.ok(today.currentBalance < 0)
  assert.equal(
    composition.find((item) => item.key === "otro")?.amount,
    7000
  )
  assert.equal(
    isTreasuryPhysicalCashIncome({
      movementType: "income",
      metadata: {},
    }),
    false
  )
})

test("UI shows Dinero en Caja beside Saldo del Período without changing period KPIs", () => {
  const cards = read("components/tesoreria/treasury-summary-cards.tsx")
  assert.match(cards, /Saldo del Período/)
  assert.match(cards, /Dinero en Caja/)
  assert.match(cards, /Efectivo acumulado del mes/)
  assert.match(cards, /tone="blue"/)
  assert.match(cards, /treasurySix/)
  assert.match(cards, /buildTreasuryDashboardSummary\(movements, now, historyRange\)/)

  const page = read("app/(dashboard)/tesoreria/page.tsx")
  assert.match(page, /count=\{6\}/)
  assert.match(page, /treasurySix/)
})
