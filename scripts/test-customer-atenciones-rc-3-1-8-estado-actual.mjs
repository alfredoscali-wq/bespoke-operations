/**
 * RC 3.1.8 / 3.2.4 — Estado actual executive badge / summary helpers.
 * Run: npx tsx --test scripts/test-customer-atenciones-rc-3-1-8-estado-actual.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  formatConsultationEstadoActualBadge,
  formatConsultationEstadoActualSummary,
  isRedundantEstadoActualDerivation,
} from "../lib/customer-atenciones/consultation-expediente.ts"

test("badge: Ventas / Técnica / Administración / espera / resuelta", () => {
  assert.equal(
    formatConsultationEstadoActualBadge({
      status: "en_gestion",
      nextStep: "contactar_cliente",
    }),
    "En Ventas"
  )
  assert.equal(
    formatConsultationEstadoActualBadge({
      status: "en_gestion",
      nextStep: "resolver_consulta_tecnica",
    }),
    "En Técnica"
  )
  assert.equal(
    formatConsultationEstadoActualBadge({
      status: "en_gestion",
      nextStep: "derivar_admin_gestion",
    }),
    "En Administración"
  )
  assert.equal(
    formatConsultationEstadoActualBadge({
      status: "en_gestion",
      nextStep: "esperar_cliente",
    }),
    "Esperando Cliente"
  )
  assert.equal(
    formatConsultationEstadoActualBadge({
      status: "resuelta",
      nextStep: null,
    }),
    "Resuelta"
  )
  assert.equal(
    formatConsultationEstadoActualBadge({
      status: "en_gestion",
      nextStep: "seguimiento_cliente",
    }),
    "En Atención al Cliente"
  )
})

test("summary: contextual natural-language sentences (RC 3.2.4)", () => {
  assert.equal(
    formatConsultationEstadoActualSummary({
      status: "en_gestion",
      nextStep: "contactar_cliente",
    }),
    "Se está evaluando la solicitud comercial del cliente."
  )
  assert.equal(
    formatConsultationEstadoActualSummary(
      {
        status: "en_gestion",
        nextStep: "resolver_consulta_tecnica",
      },
      { derivedBy: "Área Técnica" }
    ),
    "Se está analizando el inconveniente técnico informado por el cliente."
  )
  assert.equal(
    formatConsultationEstadoActualSummary({
      status: "en_gestion",
      nextStep: "derivar_admin_facturacion",
    }),
    "Se está analizando la consulta administrativa o de facturación."
  )
  assert.equal(
    formatConsultationEstadoActualSummary({
      status: "en_gestion",
      nextStep: "esperar_cliente",
    }),
    "Se está esperando una respuesta del cliente para continuar la gestión."
  )
  assert.equal(
    formatConsultationEstadoActualSummary({
      status: "en_gestion",
      nextStep: null,
    }),
    "El operador se encuentra gestionando la consulta."
  )
  assert.equal(
    formatConsultationEstadoActualSummary({
      status: "resuelta",
      nextStep: null,
    }),
    "La consulta fue resuelta correctamente."
  )
})

test("redundant derivation when from-area matches current area", () => {
  assert.equal(
    isRedundantEstadoActualDerivation(
      { status: "en_gestion", nextStep: "resolver_consulta_tecnica" },
      "Área Técnica"
    ),
    true
  )
  assert.equal(
    isRedundantEstadoActualDerivation(
      { status: "en_gestion", nextStep: "resolver_consulta_tecnica" },
      "Atención al Cliente"
    ),
    false
  )
})
