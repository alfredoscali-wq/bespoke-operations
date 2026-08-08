/**
 * Sprint Tesorería 2.0 — Retiros (withdrawal).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  isTreasuryCategoryForType,
  TREASURY_MOVEMENT_TYPES,
  TREASURY_TYPE_LABELS,
} from "../lib/tesoreria/categories.ts"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

test("withdrawal is a distinct movement type with Retiro label", () => {
  assert.equal(TREASURY_MOVEMENT_TYPES.WITHDRAWAL, "withdrawal")
  assert.equal(TREASURY_TYPE_LABELS.withdrawal, "Retiro")
  assert.equal(
    isTreasuryCategoryForType(TREASURY_MOVEMENT_TYPES.WITHDRAWAL, "retiro"),
    true
  )
  assert.equal(
    isTreasuryCategoryForType(TREASURY_MOVEMENT_TYPES.WITHDRAWAL, "combustible"),
    false
  )
  assert.equal(
    isTreasuryCategoryForType(TREASURY_MOVEMENT_TYPES.EXPENSE, "retiro"),
    false
  )
})

test("summary subtracts withdrawals separately from operational expenses", () => {
  const source = read("lib/tesoreria/summary.ts")
  assert.match(source, /WITHDRAWAL/)
  assert.match(source, /withdrawalPeriod/)
  assert.match(
    source,
    /movement\.movementType === TREASURY_MOVEMENT_TYPES\.WITHDRAWAL/
  )
  // Expense branch must not be a catch-all that swallows withdrawals.
  assert.match(source, /Operational expense/)
})

test("UI wires Registrar Retiro + orange KPI + audit event", () => {
  const module = read("components/tesoreria/treasury-module.tsx")
  assert.match(module, /Registrar Retiro/)
  assert.match(module, /WITHDRAWAL/)

  const cards = read("components/tesoreria/treasury-summary-cards.tsx")
  assert.match(cards, /Retiros del Período/)
  assert.match(cards, /Dinero retirado de caja/)
  assert.match(cards, /tone="orange"/)
  assert.match(cards, /withdrawalPeriod/)

  const form = read("components/tesoreria/treasury-movement-form-dialog.tsx")
  assert.match(form, /Retirado por/)
  assert.match(form, /Indicá quién realizó el retiro/)
  assert.match(form, /category: isWithdrawal \? "retiro"/)
  assert.match(form, /\{\!isWithdrawal \? \(/)

  const history = read("components/tesoreria/treasury-movements-history.tsx")
  assert.match(history, /WITHDRAWAL/)
  assert.match(history, /orange/)

  const activity = read("lib/activity/adapters/treasury-activity.ts")
  assert.match(activity, /TREASURY_WITHDRAWAL_CREATED/)
  assert.match(activity, /retirado_por/)
  assert.match(activity, /usuario_creador/)
  assert.match(activity, /observaciones/)
  assert.match(activity, /monto/)
  assert.match(activity, /fecha/)

  const types = read("lib/activity/types.ts")
  assert.match(types, /tesoreria_withdrawal_created/)

  const queries = read("lib/supabase/treasury.queries.ts")
  assert.match(queries, /WITHDRAWAL/)
  assert.match(queries, /quién realizó el retiro/)

  const migration = read(
    "supabase/migrations/20261121000100_tesoreria_2_0_withdrawals.sql"
  )
  assert.match(migration, /'withdrawal'/)
})
