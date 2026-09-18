/**
 * Tesorería — ajuste de saldo de caja (no cobranza OT).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  buildTreasuryCashBalanceAdjustmentInput,
  buildTreasuryCashBalanceAdjustmentMetadata,
  isTreasuryCashBalanceAdjustmentCategory,
  TREASURY_CASH_BALANCE_ADJUSTMENT_CATEGORY,
  TREASURY_CASH_BALANCE_ADJUSTMENT_SOURCE,
} from "../lib/tesoreria/cash-balance-adjustment.ts"
import {
  isTreasuryCategoryForType,
  TREASURY_INCOME_CATEGORY_LABELS,
  TREASURY_MOVEMENT_TYPES,
  TREASURY_ORIGINS,
} from "../lib/tesoreria/categories.ts"
import { buildTreasuryCashInBoxMonth } from "../lib/tesoreria/ot-rendition-payment-kpis.ts"
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
    origin: overrides.origin ?? "administration",
    category: overrides.category ?? "ajuste_saldo",
    amount: overrides.amount,
    movementDate: overrides.movementDate ?? "2026-09-18",
    employeeId: null,
    employeeName: null,
    registeredBy: null,
    registeredByName: null,
    status: overrides.status ?? "confirmed",
    notes: overrides.notes ?? "Ajuste de saldo de caja",
    receiptUrl: null,
    cashboxId: null,
    metadata: overrides.metadata ?? buildTreasuryCashBalanceAdjustmentMetadata(),
    createdAt: "2026-09-18T15:00:00.000Z",
    updatedAt: "2026-09-18T15:00:00.000Z",
    deletedAt: null,
  }
}

test("ajuste_saldo is an income category, never expense or withdrawal", () => {
  assert.equal(
    isTreasuryCategoryForType(
      TREASURY_MOVEMENT_TYPES.INCOME,
      TREASURY_CASH_BALANCE_ADJUSTMENT_CATEGORY
    ),
    true
  )
  assert.equal(
    isTreasuryCategoryForType(
      TREASURY_MOVEMENT_TYPES.EXPENSE,
      TREASURY_CASH_BALANCE_ADJUSTMENT_CATEGORY
    ),
    false
  )
  assert.equal(
    isTreasuryCategoryForType(
      TREASURY_MOVEMENT_TYPES.WITHDRAWAL,
      TREASURY_CASH_BALANCE_ADJUSTMENT_CATEGORY
    ),
    false
  )
  assert.equal(
    TREASURY_INCOME_CATEGORY_LABELS.ajuste_saldo,
    "Ajuste de saldo"
  )
})

test("builder is administration income, not OT cobranza", () => {
  const input = buildTreasuryCashBalanceAdjustmentInput({
    companyId: "co",
    amount: 297563,
    movementDate: "2026-09-18",
    notes: "Ajuste de saldo de caja +$297.563,00.",
  })

  assert.equal(input.movementType, TREASURY_MOVEMENT_TYPES.INCOME)
  assert.equal(input.origin, TREASURY_ORIGINS.ADMINISTRATION)
  assert.equal(input.category, TREASURY_CASH_BALANCE_ADJUSTMENT_CATEGORY)
  assert.notEqual(input.category, "cobranza")
  assert.notEqual(input.origin, TREASURY_ORIGINS.TASK)
  assert.equal(input.amount, 297563)
  assert.equal(input.status, "confirmed")
  assert.equal(
    input.metadata?.source,
    TREASURY_CASH_BALANCE_ADJUSTMENT_SOURCE
  )
  assert.equal(input.metadata?.paymentMethodReceived, "efectivo")
  assert.match(input.notes ?? "", /No corresponde a cobranza de OT|Ajuste de saldo/)
  assert.equal(isTreasuryCashBalanceAdjustmentCategory(input.category), true)
})

test("cash box 637297 + adjustment 297563 = 934860; pending OT unchanged", () => {
  const reference = new Date(2026, 8, 18, 15, 0, 0)
  const existing = movement({
    amount: 637297,
    category: "cobranza",
    origin: "task",
    metadata: { source: "ot_rendition", paymentMethodReceived: "efectivo" },
  })
  const adjustment = movement({ amount: 297563 })
  const pending = [
    {
      status: TREASURY_OT_RENDITION_STATUSES.PENDING,
      amount: 222222,
    },
  ]

  const beforeCash = buildTreasuryCashInBoxMonth([existing], reference)
  const afterCash = buildTreasuryCashInBoxMonth(
    [existing, adjustment],
    reference
  )
  const afterPeriod = buildTreasuryDashboardSummary(
    [existing, adjustment],
    reference,
    "month"
  )
  const pendingKpi = buildOtRenditionKpi(pending)

  assert.equal(beforeCash, 637297)
  assert.equal(afterCash, 934860)
  assert.equal(afterPeriod.income, 637297 + 297563)
  assert.equal(afterPeriod.currentBalance, 934860)
  assert.equal(pendingKpi.count, 1)
  assert.equal(pendingKpi.totalAmount, 222222)
})

test("form wires adjustment metadata; not cobranza and not fetchTasks", () => {
  const form = read(
    "components/tesoreria/treasury-movement-form-dialog.tsx"
  )
  const helper = read("lib/tesoreria/cash-balance-adjustment.ts")
  const categories = read("lib/tesoreria/categories.ts")

  assert.match(form, /buildTreasuryCashBalanceAdjustmentMetadata/)
  assert.match(form, /TREASURY_ORIGINS\.ADMINISTRATION/)
  assert.match(helper, /cash_balance_adjustment/)
  assert.match(helper, /paymentMethodReceived: "efectivo"/)
  assert.doesNotMatch(helper, /OT-717|222222/)
  assert.match(helper, /No corresponde a cobranza de OT/)
  assert.match(categories, /ajuste_saldo/)
  assert.doesNotMatch(form, /fetchTasks\(/)
})
