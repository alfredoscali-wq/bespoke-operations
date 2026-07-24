import assert from "node:assert/strict"
import test from "node:test"

import {
  isTreasuryCategoryForType,
  TREASURY_MOVEMENT_TYPES,
} from "../lib/tesoreria/categories.ts"
import {
  buildTreasuryDashboardSummary,
  filterTreasuryMovementsByRange,
} from "../lib/tesoreria/summary.ts"

function movement(overrides) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    companyId: "co",
    movementType: overrides.movementType,
    origin: "manual",
    category: overrides.category ?? "otro",
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
    metadata: {},
    createdAt: "2026-07-24T12:00:00.000Z",
    updatedAt: "2026-07-24T12:00:00.000Z",
    deletedAt: null,
  }
}

test("categories validate by movement type", () => {
  assert.equal(
    isTreasuryCategoryForType(TREASURY_MOVEMENT_TYPES.INCOME, "cobranza"),
    true
  )
  assert.equal(
    isTreasuryCategoryForType(TREASURY_MOVEMENT_TYPES.INCOME, "combustible"),
    false
  )
  assert.equal(
    isTreasuryCategoryForType(TREASURY_MOVEMENT_TYPES.EXPENSE, "combustible"),
    true
  )
})

test("dashboard summary computes balance and pending rendition", () => {
  const reference = new Date(2026, 6, 24, 15, 0, 0)
  const summary = buildTreasuryDashboardSummary(
    [
      movement({
        movementType: "income",
        amount: 1000,
        movementDate: "2026-07-24",
      }),
      movement({
        movementType: "expense",
        amount: 200,
        movementDate: "2026-07-24",
      }),
      movement({
        movementType: "expense",
        amount: 50,
        movementDate: "2026-07-24",
        status: "pending",
      }),
      movement({
        movementType: "income",
        amount: 500,
        movementDate: "2026-07-20",
      }),
      movement({
        movementType: "expense",
        amount: 100,
        movementDate: "2026-07-20",
        status: "cancelled",
      }),
    ],
    reference
  )

  assert.equal(summary.currentBalance, 1300)
  assert.equal(summary.incomeToday, 1000)
  assert.equal(summary.expenseToday, 200)
  assert.equal(summary.pendingRendition, 50)
})

test("history range filters by local day keys", () => {
  const reference = new Date(2026, 6, 24, 12, 0, 0)
  const filtered = filterTreasuryMovementsByRange(
    [
      movement({
        id: "1",
        movementType: "income",
        amount: 1,
        movementDate: "2026-07-24",
      }),
      movement({
        id: "2",
        movementType: "income",
        amount: 1,
        movementDate: "2026-07-01",
      }),
    ],
    "today",
    reference
  )
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].id, "1")
})

test("hard delete is Administrador-only", async () => {
  const { canHardDeleteTreasury, canWriteTreasury } = await import(
    "../lib/tesoreria/permissions.ts"
  )

  assert.equal(canHardDeleteTreasury("administrador"), true)
  assert.equal(canHardDeleteTreasury("administrativo"), false)
  assert.equal(canHardDeleteTreasury("supervisor"), false)
  assert.equal(canHardDeleteTreasury("operario"), false)
  assert.equal(canHardDeleteTreasury(null), false)

  assert.equal(canWriteTreasury("administrador"), true)
  assert.equal(canWriteTreasury("administrativo"), true)
  assert.equal(canWriteTreasury("supervisor"), false)
  assert.equal(canWriteTreasury("operario"), false)
})

test("removing a confirmed movement updates operational balance", () => {
  const reference = new Date(2026, 6, 24, 15, 0, 0)
  const movements = [
    movement({
      id: "keep",
      movementType: "income",
      amount: 1000,
      movementDate: "2026-07-24",
    }),
    movement({
      id: "delete-me",
      movementType: "expense",
      amount: 200,
      movementDate: "2026-07-24",
    }),
  ]

  const before = buildTreasuryDashboardSummary(movements, reference)
  assert.equal(before.currentBalance, 800)
  assert.equal(before.expenseToday, 200)

  const after = buildTreasuryDashboardSummary(
    movements.filter((item) => item.id !== "delete-me"),
    reference
  )
  assert.equal(after.currentBalance, 1000)
  assert.equal(after.expenseToday, 0)
  assert.equal(after.incomeToday, 1000)
})
