/**
 * RC 3.2.4 — Natural language in Estado Actual + Technical assistant.
 * Run: npx tsx --test scripts/test-customer-atenciones-rc-3-2-4-natural-language.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  formatConsultationEstadoActualSummary,
  isRedundantEstadoActualDerivation,
} from "../lib/customer-atenciones/consultation-expediente.ts"
import {
  getManagementAssistantOptionLabel,
} from "../lib/customer-atenciones/consultation-management-assistant.ts"
import { formatCustomerAtencionNextStepLabel } from "../lib/customer-atenciones/format.ts"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

test("estado actual never appends derivada por", () => {
  const sentence = formatConsultationEstadoActualSummary(
    { status: "en_gestion", nextStep: "resolver_consulta_tecnica" },
    { derivedBy: "Área Técnica" }
  )
  assert.equal(
    sentence,
    "Se está analizando el inconveniente técnico informado por el cliente."
  )
  assert.doesNotMatch(sentence, /derivada por/i)
})

test("redundant same-area derivation is detected", () => {
  assert.ok(
    isRedundantEstadoActualDerivation(
      { status: "para_resolver", nextStep: "resolver_consulta_tecnica" },
      "Área Técnica"
    )
  )
})

test("technical assistant option labels", () => {
  const source = fs.readFileSync(
    path.join(root, "components/atencion-cliente/technical-result-dialog.tsx"),
    "utf8"
  )
  assert.match(source, /Consulta técnica resuelta/)
  assert.match(source, /Pendiente de generar OT/)
  assert.match(source, /Requiere contacto con el cliente/)
  assert.match(source, /Esperar respuesta del cliente/)
  assert.match(source, /¿Qué resultado tuvo el análisis técnico\?/)
  assert.doesNotMatch(source, /Seguimiento con cliente/)
  assert.doesNotMatch(source, /"Esperar cliente"/)
  assert.doesNotMatch(source, /¿Qué ocurrió\?/)
})

test("administration / retention use result-oriented questions", () => {
  const admin = fs.readFileSync(
    path.join(
      root,
      "components/atencion-cliente/administration-result-dialog.tsx"
    ),
    "utf8"
  )
  const retention = fs.readFileSync(
    path.join(root, "components/atencion-cliente/retention-result-dialog.tsx"),
    "utf8"
  )
  assert.match(admin, /Requiere contacto con el cliente/)
  assert.match(admin, /¿Qué resultado tuvo la gestión administrativa\?/)
  assert.match(retention, /¿Qué resultado tuvo el intento de retención\?/)
})

test("shared next-step and assistant labels stay aligned", () => {
  assert.equal(
    formatCustomerAtencionNextStepLabel("seguimiento_cliente"),
    "Requiere contacto con el cliente"
  )
  assert.equal(
    formatCustomerAtencionNextStepLabel("esperar_cliente"),
    "Esperar respuesta del cliente"
  )
  assert.equal(
    getManagementAssistantOptionLabel("seguimiento_cliente"),
    "Requiere contacto con el cliente"
  )
  assert.equal(
    getManagementAssistantOptionLabel("esperar_cliente"),
    "Esperar respuesta del cliente"
  )
})
