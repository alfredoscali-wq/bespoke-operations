/**
 * Hotfix Tesorería — pending OT renditions are stock, not Tesorería money.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { buildTreasuryIncomeCompositionKpis } from "../lib/tesoreria/ot-rendition-payment-kpis.ts"
import { buildOtRenditionKpi } from "../lib/tesoreria/ot-renditions.ts"
import { TREASURY_OT_RENDITION_STATUSES } from "../lib/tesoreria/ot-rendition-status.ts"
import {
  buildTreasuryDashboardSummary,
  isTreasuryIncomeLinkedToPendingOtRendition,
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
    category: overrides.category ?? "cobranza",
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

function pendingRendition(overrides) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    taskId: overrides.taskId ?? crypto.randomUUID(),
    taskCode: overrides.taskCode ?? "OT-100",
    treasuryMovementId: overrides.treasuryMovementId ?? null,
    status: TREASURY_OT_RENDITION_STATUSES.PENDING,
    amount: overrides.amount ?? 349999,
  }
}

test("pending OT income is detected by taskId, renditionId, movement id and OT code", () => {
  const pending = pendingRendition({
    id: "ren-1",
    taskId: "task-1",
    taskCode: "OT-8841",
    treasuryMovementId: "mov-orphan",
  })

  assert.equal(
    isTreasuryIncomeLinkedToPendingOtRendition(
      movement({
        origin: "task",
        metadata: { source: "ot_rendition", taskId: "task-1" },
      }),
      [pending]
    ),
    true
  )
  assert.equal(
    isTreasuryIncomeLinkedToPendingOtRendition(
      movement({ origin: "manual", amount: 349999 }),
      [pending]
    ),
    false
  )
})

test("pending OT stock does not change Ingresos, Saldo del Período or composition", () => {
  const reference = new Date(2026, 7, 18, 16, 0, 0)
  const movements = [
    movement({
      origin: "task",
      amount: 19999,
      movementDate: "2026-08-18",
      metadata: { source: "ot_rendition", paymentMethodReceived: "efectivo" },
    }),
    movement({
      origin: "manual",
      category: "otro",
      amount: 7000,
      movementDate: "2026-08-18",
    }),
    movement({
      movementType: "expense",
      amount: 54000,
      movementDate: "2026-08-18",
    }),
  ]
  const pending = [
    pendingRendition({ amount: 349999 }),
    pendingRendition({ amount: 1 }),
  ]
  pending[1].amount = 0

  const withoutPending = buildTreasuryDashboardSummary(
    movements,
    reference,
    "today"
  )
  const withPendingArgIgnored = buildTreasuryDashboardSummary(
    movements,
    reference,
    "today"
  )
  const composition = buildTreasuryIncomeCompositionKpis(
    movements,
    "today",
    reference
  )
  const pendingKpi = buildOtRenditionKpi([
    pendingRendition({ amount: 349999 }),
  ])

  assert.equal(withoutPending.income, 26999)
  assert.equal(withoutPending.currentBalance, -27001)
  assert.equal(withPendingArgIgnored.currentBalance, -27001)
  assert.equal(
    composition.find((item) => item.key === "efectivo")?.amount,
    19999
  )
  assert.equal(composition.find((item) => item.key === "otro")?.amount, 7000)
  assert.equal(pendingKpi.count, 1)
  assert.equal(pendingKpi.totalAmount, 349999)
})

test("a pending OT without a treasury movement does not change period saldo", () => {
  const reference = new Date(2026, 7, 18, 16, 0, 0)
  const summary = buildTreasuryDashboardSummary(
    [
      movement({
        origin: "manual",
        amount: 53457,
        movementDate: "2026-08-18",
      }),
    ],
    reference,
    "today"
  )

  assert.equal(summary.currentBalance, 53457)
  assert.equal(summary.income, 53457)
})

test("rendida OT income still counts in saldo del período", () => {
  const reference = new Date(2026, 7, 18, 16, 0, 0)
  const summary = buildTreasuryDashboardSummary(
    [
      movement({
        origin: "task",
        amount: 80000,
        metadata: { source: "ot_rendition", taskId: "task-done" },
      }),
    ],
    reference,
    "today"
  )

  assert.equal(summary.currentBalance, 80000)
})

test("summary cards show Saldo del Período from confirmed movements", () => {
  const cards = read("components/tesoreria/treasury-summary-cards.tsx")
  assert.match(cards, /Saldo del Período/)
  assert.match(
    cards,
    /buildTreasuryDashboardSummary\(movements, now, historyRange\)/
  )
  assert.doesNotMatch(cards, /Caja física disponible/)
  assert.doesNotMatch(cards, /Saldo Actual/)
})
