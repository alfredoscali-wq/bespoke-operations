/**
 * Sprint Tesorería 2.1 — medio esperado vs medio realmente cobrado.
 * No modifica tasks.payment_method.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  formatOtRenditionPaymentAuditNote,
  formatTreasuryPaymentMethodLabel,
  isTreasuryReceivedPaymentMethod,
  readOtRenditionPaymentFromMetadata,
  resolveInitialReceivedPaymentMethod,
  resolveOtRenditionPaymentMatch,
  TREASURY_RECEIVED_PAYMENT_METHODS,
} from "../lib/tesoreria/ot-rendition-payment.ts"
import { buildOtRendidaOperationalEvent } from "../lib/tasks/operational-motivos.ts"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

test("received catalog matches Tesorería 2.1 options", () => {
  assert.deepEqual([...TREASURY_RECEIVED_PAYMENT_METHODS], [
    "efectivo",
    "transferencia",
    "debito",
    "credito",
    "mercadopago",
    "cheque",
    "otro",
  ])
  assert.equal(formatTreasuryPaymentMethodLabel("efectivo"), "Efectivo")
  assert.equal(formatTreasuryPaymentMethodLabel("transferencia"), "Transferencia")
  assert.equal(formatTreasuryPaymentMethodLabel("debito"), "Débito")
  assert.equal(formatTreasuryPaymentMethodLabel("credito"), "Crédito")
  assert.equal(formatTreasuryPaymentMethodLabel("mercadopago"), "Mercado Pago")
  assert.equal(formatTreasuryPaymentMethodLabel("cheque"), "Cheque")
  assert.equal(formatTreasuryPaymentMethodLabel("otro"), "Otro")
  assert.equal(formatTreasuryPaymentMethodLabel("tarjeta"), "Tarjeta")
  assert.equal(isTreasuryReceivedPaymentMethod("cheque"), true)
  assert.equal(isTreasuryReceivedPaymentMethod("tarjeta"), false)
})

test("select initial value is the expected payment method", () => {
  assert.equal(resolveInitialReceivedPaymentMethod("efectivo"), "efectivo")
  assert.equal(
    resolveInitialReceivedPaymentMethod("transferencia"),
    "transferencia"
  )
  assert.equal(resolveInitialReceivedPaymentMethod("tarjeta"), "tarjeta")
  assert.equal(resolveInitialReceivedPaymentMethod(null), "efectivo")
})

test("match vs modified badges", () => {
  assert.equal(
    resolveOtRenditionPaymentMatch("efectivo", "efectivo"),
    "match"
  )
  assert.equal(
    resolveOtRenditionPaymentMatch("efectivo", "transferencia"),
    "modified"
  )
  assert.equal(resolveOtRenditionPaymentMatch("efectivo", null), null)
  assert.equal(resolveOtRenditionPaymentMatch(null, "efectivo"), null)

  const badge = read("components/tesoreria/treasury-payment-match-badge.tsx")
  assert.doesNotMatch(badge, /✓ Coincide/)
  assert.match(badge, /⚠ Medio Modificado/)
  assert.match(badge, /match !== "modified"/)
  assert.match(badge, /Esperado:/)
  assert.match(badge, /Cobrado:/)
})

test("audit note and operational event keep Esperado / Cobrado without mutating OT", () => {
  assert.equal(
    formatOtRenditionPaymentAuditNote({
      expected: "efectivo",
      received: "transferencia",
    }),
    "Rendición de Cobranza · Esperado: Efectivo · Cobrado: Transferencia"
  )

  const event = buildOtRendidaOperationalEvent({
    companyId: "co-1",
    taskId: "ot-1",
    taskCode: "OT-125",
    customerName: "Juan Perez",
    crewName: "Cuadrilla A",
    amount: 25000,
    deliveredBy: "",
    actor: {
      userId: "u-1",
      employeeId: "e-1",
      fullName: "Tesorería",
      area: "Tesorería",
      role: "Administración",
    },
    paymentMethodExpected: "efectivo",
    paymentMethodReceived: "transferencia",
  })
  assert.equal(event.title, "Rendición de Cobranza")
  assert.match(event.description ?? "", /Esperado: Efectivo/)
  assert.match(event.description ?? "", /Cobrado: Transferencia/)
  assert.equal(event.payload.payment_method_expected, "efectivo")
  assert.equal(event.payload.payment_method_received, "transferencia")
})

test("confirm persists expected + received and never writes tasks.payment_method", () => {
  const queries = read("lib/supabase/treasury-ot-renditions.queries.ts")
  assert.match(queries, /payment_method_expected/)
  assert.match(queries, /payment_method_received/)
  assert.match(queries, /paymentMethodReceived/)
  assert.match(queries, /INVALID_PAYMENT_METHOD/)
  assert.doesNotMatch(queries, /\.from\(["']tasks["']\)/)
  assert.doesNotMatch(queries, /payment_method:/)

  const mapper = read("lib/supabase/treasury-ot-renditions.mapper.ts")
  assert.match(mapper, /paymentMethodExpected/)
  assert.match(mapper, /paymentMethodReceived/)

  const types = read("lib/types/treasury-ot-renditions.ts")
  assert.match(types, /paymentMethodReceived: string/)
})

test("migration snapshots OT payment_method and does not update tasks", () => {
  const migration = read(
    "supabase/migrations/20261127000100_tesoreria_2_1_payment_method_received.sql"
  )
  assert.match(migration, /ADD COLUMN IF NOT EXISTS payment_method_expected/)
  assert.match(migration, /ADD COLUMN IF NOT EXISTS payment_method_received/)
  assert.match(migration, /payment_method_expected = nullif\(trim\(t\.payment_method\)/)
  assert.match(migration, /INSERT INTO public\.treasury_ot_renditions/)
  assert.match(migration, /payment_method_expected/)
  assert.match(migration, /nullif\(trim\(t\.payment_method\), ''\)/)
  assert.doesNotMatch(migration, /UPDATE public\.tasks/)
})

test("Pendientes, modal Rendir Cobranza and Historial stay in Tesorería", () => {
  const list = read("components/tesoreria/treasury-pending-renditions-list.tsx")
  assert.match(list, /Medio Esperado/)
  assert.match(list, /formatTreasuryPaymentMethodLabel\(row\.paymentMethodExpected\)/)
  assert.match(list, /colSpan=\{8\}/)

  const dialog = read("components/tesoreria/treasury-confirm-rendition-dialog.tsx")
  assert.match(dialog, /Rendir Cobranza/)
  assert.match(dialog, />Cobranza</)
  assert.match(dialog, /Medio esperado/)
  assert.match(dialog, /Medio realmente cobrado/)
  assert.match(dialog, /TREASURY_RECEIVED_PAYMENT_METHOD_OPTIONS/)
  assert.match(dialog, /resolveInitialReceivedPaymentMethod/)
  assert.match(dialog, /paymentMethodReceived/)
  assert.match(dialog, /TreasuryPaymentMatchBadge/)

  const history = read("components/tesoreria/treasury-movements-history.tsx")
  assert.match(history, /TreasuryPaymentMatchBadge/)
  assert.match(history, /ot_rendition/)

  const tesoreriaFiles = [
    "components/tesoreria/treasury-pending-renditions-list.tsx",
    "components/tesoreria/treasury-confirm-rendition-dialog.tsx",
    "components/tesoreria/treasury-movements-history.tsx",
    "components/tesoreria/treasury-payment-match-badge.tsx",
    "lib/supabase/treasury-ot-renditions.queries.ts",
    "lib/tasks/operational-motivos.ts",
  ]
  for (const relPath of tesoreriaFiles) {
    assert.match(read(relPath), /ot-rendition-payment|payment_method_received|paymentMethodReceived/)
  }

  const obras = read("components/obras/projects-module.tsx")
  assert.doesNotMatch(obras, /paymentMethodReceived|Medio realmente cobrado/)
  const planning = read("components/planificacion/planning-module.tsx")
  assert.doesNotMatch(planning, /paymentMethodReceived|Medio realmente cobrado/)
})

test("history metadata helper reads expected vs received", () => {
  const match = readOtRenditionPaymentFromMetadata({
    source: "ot_rendition",
    paymentMethodExpected: "efectivo",
    paymentMethodReceived: "transferencia",
  })
  assert.deepEqual(match, {
    expected: "efectivo",
    received: "transferencia",
  })
  assert.equal(
    resolveOtRenditionPaymentMatch(match.expected, match.received),
    "modified"
  )
})
