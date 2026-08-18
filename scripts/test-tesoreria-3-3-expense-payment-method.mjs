/**
 * Sprint Tesorería 3.3 — medio de pago en egresos y corrección de Dinero en Caja.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { mapUpdateTreasuryMovementInput } from "../lib/supabase/treasury.mapper.ts"
import {
  formatTreasuryExpensePaymentMethodLabel,
  TREASURY_UNSPECIFIED_PAYMENT_METHOD_LABEL,
} from "../lib/tesoreria/ot-rendition-payment.ts"
import {
  buildTreasuryCashInBoxMonth,
  isTreasuryPhysicalCashExpense,
  readTreasuryIncomeReceivedPaymentMethod,
} from "../lib/tesoreria/ot-rendition-payment-kpis.ts"
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

const cashIncome = movement({
  origin: "task",
  amount: 164996,
  metadata: {
    source: "ot_rendition",
    paymentMethodReceived: "efectivo",
  },
})

function expense(method, amount, extra = {}) {
  const { metadata, category, ...rest } = extra
  return movement({
    ...rest,
    movementType: "expense",
    category: category ?? "combustible",
    amount,
    metadata:
      method == null
        ? metadata ?? {}
        : { ...(metadata ?? {}), paymentMethod: method },
  })
}

function historyLabel(item) {
  return formatTreasuryExpensePaymentMethodLabel(
    readTreasuryIncomeReceivedPaymentMethod(item)
  )
}

test("A) cash expense appears as Efectivo and reduces Dinero en Caja", () => {
  const cashExpense = expense("efectivo", 100000)
  const cash = buildTreasuryCashInBoxMonth([cashIncome, cashExpense], reference)
  assert.equal(historyLabel(cashExpense), "Efectivo")
  assert.equal(isTreasuryPhysicalCashExpense(cashExpense), true)
  assert.equal(cash, 64996)
})

test("B) transfer expense appears as Transferencia and does not reduce Dinero en Caja", () => {
  const transferExpense = expense("transferencia", 500000)
  const cash = buildTreasuryCashInBoxMonth(
    [cashIncome, transferExpense],
    reference
  )
  assert.equal(historyLabel(transferExpense), "Transferencia")
  assert.equal(isTreasuryPhysicalCashExpense(transferExpense), false)
  assert.equal(cash, 164996)
})

test("C) Mercado Pago expense does not reduce Dinero en Caja", () => {
  const item = expense("mercadopago", 80000)
  assert.equal(historyLabel(item), "Mercado Pago")
  assert.equal(
    buildTreasuryCashInBoxMonth([cashIncome, item], reference),
    164996
  )
})

test("D) debit expense does not reduce Dinero en Caja", () => {
  const item = expense("debito", 15000)
  assert.equal(historyLabel(item), "Débito")
  assert.equal(
    buildTreasuryCashInBoxMonth([cashIncome, item], reference),
    164996
  )
})

test("E) credit expense does not reduce Dinero en Caja", () => {
  const item = expense("credito", 22000)
  assert.equal(historyLabel(item), "Crédito")
  assert.equal(
    buildTreasuryCashInBoxMonth([cashIncome, item], reference),
    164996
  )
})

test("F) cheque expense does not reduce Dinero en Caja", () => {
  const item = expense("cheque", 40000)
  assert.equal(historyLabel(item), "Cheque")
  assert.equal(
    buildTreasuryCashInBoxMonth([cashIncome, item], reference),
    164996
  )
})

test("G) other expense does not reduce Dinero en Caja", () => {
  const item = expense("otro", 452000)
  assert.equal(historyLabel(item), "Otro")
  assert.equal(
    buildTreasuryCashInBoxMonth([cashIncome, item], reference),
    164996
  )
})

test("H) withdrawal reduces Dinero en Caja", () => {
  const withdrawal = movement({
    movementType: "withdrawal",
    category: "retiro",
    amount: 20000,
  })
  assert.equal(
    buildTreasuryCashInBoxMonth([cashIncome, withdrawal], reference),
    144996
  )
})

test("I) historical expense without method is Sin especificar and does not reduce cash", () => {
  const historical = expense(null, 24000, { category: "repuestos" })
  assert.equal(historyLabel(historical), TREASURY_UNSPECIFIED_PAYMENT_METHOD_LABEL)
  assert.equal(isTreasuryPhysicalCashExpense(historical), false)
  assert.equal(
    buildTreasuryCashInBoxMonth([cashIncome, historical], reference),
    164996
  )
})

test("J) cancelling a cash expense stops reducing Dinero en Caja", () => {
  const cashExpense = expense("efectivo", 100000)
  const before = buildTreasuryCashInBoxMonth(
    [cashIncome, cashExpense],
    reference
  )
  const cancelled = { ...cashExpense, status: "cancelled" }
  const after = buildTreasuryCashInBoxMonth(
    [cashIncome, cancelled],
    reference
  )
  assert.equal(before, 64996)
  assert.equal(after, 164996)
})

test("K) changing Efectivo → Transferencia stops reducing Dinero en Caja", () => {
  const cashExpense = expense("efectivo", 100000)
  const before = buildTreasuryCashInBoxMonth(
    [cashIncome, cashExpense],
    reference
  )
  const updated = {
    ...cashExpense,
    metadata: { paymentMethod: "transferencia" },
  }
  const after = buildTreasuryCashInBoxMonth([cashIncome, updated], reference)
  assert.equal(before, 64996)
  assert.equal(after, 164996)
  assert.equal(isTreasuryPhysicalCashExpense(updated), false)
})

test("L) changing Transferencia → Efectivo starts reducing Dinero en Caja", () => {
  const transferExpense = expense("transferencia", 100000)
  const before = buildTreasuryCashInBoxMonth(
    [cashIncome, transferExpense],
    reference
  )
  const updated = {
    ...transferExpense,
    metadata: { paymentMethod: "efectivo" },
  }
  const after = buildTreasuryCashInBoxMonth([cashIncome, updated], reference)
  assert.equal(before, 164996)
  assert.equal(after, 64996)
  assert.equal(isTreasuryPhysicalCashExpense(updated), true)
})

test("M) Saldo del Período still counts every confirmed expense regardless of method", () => {
  const movements = [
    cashIncome,
    movement({
      origin: "task",
      amount: 375000,
      metadata: { paymentMethodReceived: "transferencia" },
    }),
    movement({
      origin: "manual",
      category: "otro",
      amount: 636000,
      metadata: { paymentMethod: "otro" },
    }),
    expense("efectivo", 100000),
    expense("transferencia", 500000),
    expense("otro", 452000),
    movement({
      movementType: "withdrawal",
      category: "retiro",
      amount: 20000,
    }),
  ]

  const month = buildTreasuryDashboardSummary(movements, reference, "month")
  const cash = buildTreasuryCashInBoxMonth(movements, reference)

  assert.equal(month.income, 1175996)
  assert.equal(month.expense, 1052000)
  assert.equal(month.withdrawalPeriod, 20000)
  assert.equal(month.currentBalance, 103996)
  assert.equal(cash, 44996)
})

test("N) Hoy/Semana/Mes/Todo do not change monthly Dinero en Caja", () => {
  const movements = [
    cashIncome,
    expense("efectivo", 100000),
    expense("transferencia", 500000),
    movement({
      movementType: "withdrawal",
      category: "retiro",
      amount: 20000,
    }),
  ]

  const cash = buildTreasuryCashInBoxMonth(movements, reference)
  assert.equal(cash, 44996)

  const today = buildTreasuryDashboardSummary(movements, reference, "today")
  const week = buildTreasuryDashboardSummary(movements, reference, "week")
  const month = buildTreasuryDashboardSummary(movements, reference, "month")
  const all = buildTreasuryDashboardSummary(movements, reference, "all")
  assert.equal(today.currentBalance, month.currentBalance)
  assert.equal(week.currentBalance, month.currentBalance)
  assert.equal(all.currentBalance, month.currentBalance)
  assert.equal(buildTreasuryCashInBoxMonth(movements, reference), cash)

  const cards = read("components/tesoreria/treasury-summary-cards.tsx")
  assert.match(cards, /buildTreasuryCashInBoxMonth\(movements, now\)/)
  assert.doesNotMatch(
    cards,
    /buildTreasuryCashInBoxMonth\(movements, now, historyRange\)/
  )
})

test("UI stores expense payment method, shows it in history, and reuses the income catalog", () => {
  const form = read("components/tesoreria/treasury-movement-form-dialog.tsx")
  assert.match(form, /Medio de pago/)
  assert.match(form, /isExpense/)
  assert.match(form, /TREASURY_RECEIVED_PAYMENT_METHOD_OPTIONS/)
  assert.match(form, /paymentMethod: form\.paymentMethod/)
  assert.match(form, /Seleccioná el medio de pago/)
  assert.doesNotMatch(form, /payment_method_received/)

  const history = read("components/tesoreria/treasury-movements-history.tsx")
  assert.match(history, /formatTreasuryExpensePaymentMethodLabel/)
  assert.match(history, /TREASURY_MOVEMENT_TYPES\.EXPENSE/)

  const mapper = read("lib/supabase/treasury.mapper.ts")
  assert.match(mapper, /if \(input\.metadata !== undefined\) update\.metadata/)

  const labels = read("lib/tesoreria/ot-rendition-payment.ts")
  assert.match(labels, /Sin especificar/)

  const kpis = read("lib/tesoreria/ot-rendition-payment-kpis.ts")
  assert.match(kpis, /isTreasuryPhysicalCashExpense/)
  assert.match(kpis, /Only expenses with medio/)

  const payload = mapUpdateTreasuryMovementInput({
    metadata: { paymentMethod: "transferencia" },
  })
  assert.deepEqual(payload.metadata, { paymentMethod: "transferencia" })
})
