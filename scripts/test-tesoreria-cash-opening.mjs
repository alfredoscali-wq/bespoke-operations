/**
 * Tesorería — base de caja física + medio de pago en ingresos manuales.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { hasTreasuryCashOpening } from "../lib/tesoreria/cash-opening.ts"
import {
  isTreasuryCategoryForType,
  TREASURY_INCOME_CATEGORY_LABELS,
  TREASURY_MOVEMENT_TYPES,
} from "../lib/tesoreria/categories.ts"
import {
  buildTreasuryCashInBoxMonth,
  buildTreasuryIncomeCompositionKpis,
  buildTreasuryIncomePaymentMetadata,
  isTreasuryIncomePaymentMethod,
  TREASURY_INCOME_PAYMENT_METHOD_OPTIONS,
} from "../lib/tesoreria/ot-rendition-payment-kpis.ts"
import { TREASURY_OT_RENDITION_STATUSES } from "../lib/tesoreria/ot-rendition-status.ts"
import { listPendingOtRenditions } from "../lib/tesoreria/ot-renditions.ts"
import { buildTreasuryDashboardSummary } from "../lib/tesoreria/summary.ts"

const root = resolve(import.meta.dirname, "..")
const FAKE_ID = "f2bb4a6a-b348-4847-b9ca-14392a954c5f"
const WITHDRAWAL_ID = "daf6659c-99c1-40aa-ab49-0bbb1a9dc93e"
const OT717_TASK = "24f4bf05-2e06-4011-9056-5794fe30c913"
const OT717_RENDITION = "413d0523-8932-4d09-b805-26db09012e83"

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
    movementDate: overrides.movementDate ?? "2026-09-18",
    employeeId: null,
    employeeName: null,
    registeredBy: null,
    registeredByName: null,
    status: overrides.status ?? "confirmed",
    notes: overrides.notes ?? "",
    receiptUrl: null,
    cashboxId: null,
    metadata: overrides.metadata ?? {},
    createdAt: "2026-09-18T15:00:00.000Z",
    updatedAt: "2026-09-18T15:00:00.000Z",
    deletedAt: overrides.deletedAt ?? null,
  }
}

const reference = new Date(2026, 8, 18, 15, 30, 0)
const opening = {
  companyId: "co",
  openingBalance: 934860,
  asOfDate: "2026-09-18",
  notes: "Caja física real",
}

test("ajuste_saldo is not an income category", () => {
  assert.equal(
    isTreasuryCategoryForType(TREASURY_MOVEMENT_TYPES.INCOME, "ajuste_saldo"),
    false
  )
  assert.equal("ajuste_saldo" in TREASURY_INCOME_CATEGORY_LABELS, false)
  assert.doesNotMatch(read("lib/tesoreria/categories.ts"), /ajuste_saldo/)
  assert.doesNotMatch(
    read("components/tesoreria/treasury-movement-form-dialog.tsx"),
    /Ajuste de saldo|ajuste_saldo/
  )
})

test("fictitious 297563 income is excluded from period saldo and composition", () => {
  const withdrawal = movement({
    id: WITHDRAWAL_ID,
    movementType: "withdrawal",
    category: "retiro",
    amount: 600000,
    notes: "pagos en efectivo",
  })
  const remaining = [withdrawal]

  assert.equal(
    remaining.some((item) => item.id === FAKE_ID),
    false
  )
  assert.doesNotMatch(
    read("lib/tesoreria/categories.ts"),
    /cash_balance_adjustment|ajuste_saldo/
  )

  const today = buildTreasuryDashboardSummary(remaining, reference, "today")
  const composition = buildTreasuryIncomeCompositionKpis(
    remaining,
    "today",
    reference
  )

  assert.equal(today.income, 0)
  assert.equal(today.expense, 0)
  assert.equal(today.withdrawalPeriod, 600000)
  assert.equal(today.currentBalance, -600000)
  assert.equal(
    composition.find((item) => item.key === "efectivo")?.amount,
    0
  )
  assert.equal(
    composition.reduce((sum, item) => sum + item.amount, 0),
    0
  )
})

test("real 600000 withdrawal remains and opening cash 934860 becomes 334860", () => {
  const withdrawal = movement({
    id: WITHDRAWAL_ID,
    movementType: "withdrawal",
    category: "retiro",
    amount: 600000,
  })
  const priorMonthCash = movement({
    amount: 637297,
    movementDate: "2026-09-01",
    metadata: { paymentMethodReceived: "efectivo" },
  })

  assert.equal(hasTreasuryCashOpening(opening), true)
  assert.equal(
    buildTreasuryCashInBoxMonth([priorMonthCash], reference, opening),
    934860
  )
  assert.equal(
    buildTreasuryCashInBoxMonth(
      [priorMonthCash, withdrawal],
      reference,
      opening
    ),
    334860
  )
})

test("manual income Efectivo affects caja; transfer/MP/tarjeta do not", () => {
  const withdrawal = movement({
    movementType: "withdrawal",
    category: "retiro",
    amount: 600000,
  })
  const efectivo = movement({
    amount: 50000,
    metadata: buildTreasuryIncomePaymentMetadata("efectivo"),
  })
  const transferencia = movement({
    amount: 50000,
    metadata: buildTreasuryIncomePaymentMetadata("transferencia"),
  })
  const mp = movement({
    amount: 50000,
    metadata: buildTreasuryIncomePaymentMetadata("mercadopago"),
  })
  const tarjeta = movement({
    amount: 50000,
    metadata: buildTreasuryIncomePaymentMetadata("tarjeta"),
  })

  const base = [withdrawal]
  assert.equal(buildTreasuryCashInBoxMonth(base, reference, opening), 334860)
  assert.equal(
    buildTreasuryCashInBoxMonth([...base, efectivo], reference, opening),
    384860
  )
  assert.equal(
    buildTreasuryCashInBoxMonth([...base, transferencia], reference, opening),
    334860
  )
  assert.equal(
    buildTreasuryCashInBoxMonth([...base, mp], reference, opening),
    334860
  )
  assert.equal(
    buildTreasuryCashInBoxMonth([...base, tarjeta], reference, opening),
    334860
  )
})

test("income payment methods persist with composition catalog values", () => {
  assert.deepEqual(
    TREASURY_INCOME_PAYMENT_METHOD_OPTIONS.map((item) => item.value),
    ["efectivo", "transferencia", "mercadopago", "tarjeta", "cheque", "otro"]
  )
  assert.deepEqual(
    TREASURY_INCOME_PAYMENT_METHOD_OPTIONS.map((item) => item.label),
    [
      "Efectivo",
      "Transferencias",
      "Mercado Pago",
      "Tarjetas",
      "Cheques",
      "Otros",
    ]
  )
  assert.equal(isTreasuryIncomePaymentMethod("efectivo"), true)
  assert.equal(isTreasuryIncomePaymentMethod("debito"), false)
  assert.deepEqual(buildTreasuryIncomePaymentMetadata("transferencia"), {
    paymentMethod: "transferencia",
    paymentMethodReceived: "transferencia",
  })

  const composition = buildTreasuryIncomeCompositionKpis(
    [
      movement({
        amount: 50000,
        metadata: buildTreasuryIncomePaymentMetadata("transferencia"),
      }),
    ],
    "today",
    reference
  )
  assert.equal(
    composition.find((item) => item.key === "transferencia")?.amount,
    50000
  )
  assert.equal(composition.find((item) => item.key === "efectivo")?.amount, 0)
})

test("OT-717 pending is gone; other pendings remain", () => {
  const renditions = [
    {
      id: "bf96728d-a58d-47bd-a7c0-e49889b139ba",
      taskId: "other-1",
      status: TREASURY_OT_RENDITION_STATUSES.PENDING,
      amount: 85000,
    },
    {
      id: "64af0328-129b-4dad-8a33-caad9457c8fe",
      taskId: "other-2",
      status: TREASURY_OT_RENDITION_STATUSES.PENDING,
      amount: 45000,
    },
    {
      id: "8377ab29-a1e4-46d0-85d0-a6146fc1f15c",
      taskId: "other-3",
      status: TREASURY_OT_RENDITION_STATUSES.PENDING,
      amount: 49000,
    },
  ]
  const pending = listPendingOtRenditions(renditions)
  assert.equal(pending.length, 3)
  assert.equal(
    pending.some((item) => item.id === OT717_RENDITION),
    false
  )
  assert.equal(
    pending.some((item) => item.taskId === OT717_TASK),
    false
  )
})

test("form requires income payment method and opening is not a movement", () => {
  const form = read("components/tesoreria/treasury-movement-form-dialog.tsx")
  const cards = read("components/tesoreria/treasury-summary-cards.tsx")
  const provider = read("components/tesoreria/treasury-provider.tsx")
  const migration = read(
    "supabase/migrations/20261127100100_tesoreria_cash_opening_balance.sql"
  )
  const queries = read("lib/supabase/treasury-cash-settings.queries.ts")

  assert.match(form, /isIncome/)
  assert.match(form, /TREASURY_INCOME_PAYMENT_METHOD_OPTIONS/)
  assert.match(form, /buildTreasuryIncomePaymentMetadata/)
  assert.match(form, /Medio de pago \*/)
  assert.match(cards, /cashOpening/)
  assert.match(cards, /Efectivo físico en caja/)
  assert.match(provider, /listTreasuryCashSettings/)
  assert.match(migration, /CREATE TABLE public\.treasury_cash_settings/)
  assert.match(queries, /treasury_cash_settings/)
  assert.doesNotMatch(migration, /INSERT INTO public\.treasury_movements/)
  assert.doesNotMatch(form, /fetchTasks\(/)
})
