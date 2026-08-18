/**
 * Sprint Tesorería 2.2 — KPIs dinámicos por medio de cobro (payment_method_received).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  buildOtRenditionPaymentMethodKpis,
  resolveTreasuryPaymentMethodKpiBucket,
  TREASURY_PAYMENT_METHOD_KPI_HINT,
  TREASURY_PAYMENT_METHOD_KPI_KEYS,
  TREASURY_PAYMENT_METHOD_KPI_LABELS,
} from "../lib/tesoreria/ot-rendition-payment-kpis.ts"
import { TREASURY_OT_RENDITION_STATUSES } from "../lib/tesoreria/ot-rendition-status.ts"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

function todayKey(reference = new Date()) {
  const year = reference.getFullYear()
  const month = String(reference.getMonth() + 1).padStart(2, "0")
  const day = String(reference.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

test("bucket mapping groups debit/credit/tarjeta into Tarjetas", () => {
  assert.equal(resolveTreasuryPaymentMethodKpiBucket("efectivo"), "efectivo")
  assert.equal(
    resolveTreasuryPaymentMethodKpiBucket("transferencia"),
    "transferencia"
  )
  assert.equal(
    resolveTreasuryPaymentMethodKpiBucket("mercadopago"),
    "mercadopago"
  )
  assert.equal(
    resolveTreasuryPaymentMethodKpiBucket("mercado_pago"),
    "mercadopago"
  )
  assert.equal(resolveTreasuryPaymentMethodKpiBucket("debito"), "tarjetas")
  assert.equal(resolveTreasuryPaymentMethodKpiBucket("credito"), "tarjetas")
  assert.equal(resolveTreasuryPaymentMethodKpiBucket("tarjeta"), "tarjetas")
  assert.equal(resolveTreasuryPaymentMethodKpiBucket("cheque"), "cheque")
  assert.equal(resolveTreasuryPaymentMethodKpiBucket("otro"), "otro")
  assert.equal(resolveTreasuryPaymentMethodKpiBucket(null), null)
  assert.equal(resolveTreasuryPaymentMethodKpiBucket("expected"), null)
})

test("visual order and labels match Tesorería 2.2", () => {
  assert.deepEqual([...TREASURY_PAYMENT_METHOD_KPI_KEYS], [
    "efectivo",
    "transferencia",
    "mercadopago",
    "tarjetas",
    "cheque",
    "otro",
  ])
  assert.equal(TREASURY_PAYMENT_METHOD_KPI_LABELS.efectivo, "Efectivo")
  assert.equal(
    TREASURY_PAYMENT_METHOD_KPI_LABELS.transferencia,
    "Transferencias"
  )
  assert.equal(TREASURY_PAYMENT_METHOD_KPI_LABELS.mercadopago, "Mercado Pago")
  assert.equal(TREASURY_PAYMENT_METHOD_KPI_LABELS.tarjetas, "Tarjetas")
  assert.equal(TREASURY_PAYMENT_METHOD_KPI_LABELS.cheque, "Cheques")
  assert.equal(TREASURY_PAYMENT_METHOD_KPI_LABELS.otro, "Otros")
})

test("sums today by payment_method_received and keeps zero buckets visible", () => {
  const now = new Date(2026, 7, 13, 12, 0, 0)
  const day = todayKey(now)
  const kpis = buildOtRenditionPaymentMethodKpis(
    [
      {
        status: TREASURY_OT_RENDITION_STATUSES.RENDERED,
        amount: 120000,
        collectionDate: day,
        paymentMethodReceived: "efectivo",
      },
      {
        status: TREASURY_OT_RENDITION_STATUSES.RENDERED,
        amount: 340000,
        collectionDate: day,
        paymentMethodReceived: "transferencia",
      },
      {
        status: TREASURY_OT_RENDITION_STATUSES.RENDERED,
        amount: 40000,
        collectionDate: day,
        paymentMethodReceived: "debito",
      },
      {
        status: TREASURY_OT_RENDITION_STATUSES.RENDERED,
        amount: 20000,
        collectionDate: day,
        paymentMethodReceived: "credito",
      },
      {
        status: TREASURY_OT_RENDITION_STATUSES.RENDERED,
        amount: 85000,
        collectionDate: day,
        paymentMethodReceived: "mercadopago",
      },
      {
        status: TREASURY_OT_RENDITION_STATUSES.RENDERED,
        amount: 999,
        collectionDate: day,
        paymentMethodReceived: null,
      },
      {
        status: TREASURY_OT_RENDITION_STATUSES.PENDING,
        amount: 50000,
        collectionDate: day,
        paymentMethodReceived: "efectivo",
      },
      {
        status: TREASURY_OT_RENDITION_STATUSES.RENDERED,
        amount: 50000,
        collectionDate: "2026-08-12",
        paymentMethodReceived: "cheque",
      },
    ],
    "today",
    now
  )

  assert.deepEqual(
    kpis.map((item) => ({ key: item.key, amount: item.amount })),
    [
      { key: "efectivo", amount: 120000 },
      { key: "transferencia", amount: 340000 },
      { key: "mercadopago", amount: 85000 },
      { key: "tarjetas", amount: 60000 },
      { key: "cheque", amount: 0 },
      { key: "otro", amount: 0 },
    ]
  )
})

test("zero-amount methods stay visible at $0", () => {
  const now = new Date(2026, 7, 13, 12, 0, 0)
  const day = todayKey(now)
  const withoutMp = buildOtRenditionPaymentMethodKpis(
    [
      {
        status: TREASURY_OT_RENDITION_STATUSES.RENDERED,
        amount: 120000,
        collectionDate: day,
        paymentMethodReceived: "efectivo",
      },
      {
        status: TREASURY_OT_RENDITION_STATUSES.RENDERED,
        amount: 340000,
        collectionDate: day,
        paymentMethodReceived: "transferencia",
      },
    ],
    "today",
    now
  )
  assert.deepEqual(
    withoutMp.map((item) => item.key),
    [
      "efectivo",
      "transferencia",
      "mercadopago",
      "tarjetas",
      "cheque",
      "otro",
    ]
  )
  assert.equal(
    withoutMp.find((item) => item.key === "mercadopago")?.amount,
    0
  )
})

test("uses payment_method_received, never expected", () => {
  const source = read("lib/tesoreria/ot-rendition-payment-kpis.ts")
  assert.match(source, /paymentMethodReceived/)
  assert.doesNotMatch(source, /paymentMethodExpected/)
  assert.match(source, /TREASURY_OT_RENDITION_STATUSES\.RENDERED/)
})

test("UI secondary row under primary KPIs without filters or semaphores", () => {
  const summary = read("components/tesoreria/treasury-summary-cards.tsx")
  assert.match(summary, /TreasuryPaymentMethodKpis/)
  assert.match(summary, /label="Ingresos"/)
  assert.match(summary, /Pendientes de Rendición|TreasuryPendingRenditionKpi/)
  assert.match(summary, /Saldo del Período/)
  assert.doesNotMatch(summary, /Caja física disponible/)
  assert.doesNotMatch(summary, /Saldo Actual/)

  const secondary = read(
    "components/tesoreria/treasury-payment-method-kpis.tsx"
  )
  assert.match(secondary, /Composición de la cobranza/)
  assert.match(secondary, /TREASURY_PAYMENT_METHOD_KPI_HINT/)
  assert.match(secondary, /buildTreasuryIncomeCompositionKpis/)
  assert.match(secondary, /tone="gray"/)
  assert.match(secondary, /disabled/)
  assert.doesNotMatch(secondary, /onClick|href=/)
  assert.match(TREASURY_PAYMENT_METHOD_KPI_HINT, /coincide con Ingresos/)
})
