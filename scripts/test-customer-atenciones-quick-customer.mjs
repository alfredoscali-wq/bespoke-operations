import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { validateNewConsultationInput } from "../lib/customer-atenciones/consultation.ts"
import {
  mapQuickCustomerToCreatePayload,
  validateQuickCustomerInput,
} from "../lib/customers/quick-customer.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const formPath = join(
  __dirname,
  "../components/atencion-cliente/atencion-form-dialog.tsx"
)
const providerPath = join(
  __dirname,
  "../components/atencion-cliente/atencion-cliente-provider.tsx"
)

const baseInput = {
  channel: "whatsapp",
  motivo: "consulta",
  detail: "Consulta por factura",
  decision: "resolver_ahora",
  resolution: "Se explicó el detalle",
}

test("quick customer requiere nombre", () => {
  assert.equal(validateQuickCustomerInput({ name: "   " }), "Completá el nombre del cliente.")
  assert.equal(validateQuickCustomerInput({ name: "Juan Pérez" }), null)
})

test("mapQuickCustomerToCreatePayload usa review y activo", () => {
  const payload = mapQuickCustomerToCreatePayload(
    {
      name: "  María López ",
      phone: " 11 2222-3333 ",
      dni: " 30111222 ",
    },
    "company-1"
  )

  assert.equal(payload.companyId, "company-1")
  assert.equal(payload.name, "María López")
  assert.equal(payload.phone, "11 2222-3333")
  assert.equal(payload.dni, "30111222")
  assert.equal(payload.status, "activo")
  assert.equal(payload.validationStatus, "review")
})

test("validateNewConsultationInput acepta quickCustomer sin customerId", () => {
  const validation = validateNewConsultationInput({
    ...baseInput,
    quickCustomer: { name: "Ex cliente" },
  })

  assert.equal(validation, null)
})

test("validateNewConsultationInput rechaza ambos identificadores", () => {
  const validation = validateNewConsultationInput({
    ...baseInput,
    customerId: "customer-1",
    quickCustomer: { name: "Ex cliente" },
  })

  assert.match(validation ?? "", /no ambos/i)
})

test("validateNewConsultationInput rechaza sin cliente", () => {
  const validation = validateNewConsultationInput({
    ...baseInput,
  })

  assert.match(validation ?? "", /cliente no registrado/i)
})

test("formulario expone modo cliente no registrado", () => {
  const formSource = readFileSync(formPath, "utf8")
  assert.match(formSource, /Cliente no registrado/)
  assert.match(formSource, /Cliente registrado/)
  assert.match(formSource, /quickCustomer/)
})

test("provider crea cliente antes de la atención", () => {
  const providerSource = readFileSync(providerPath, "utf8")
  assert.match(providerSource, /createCustomerInSupabase/)
  assert.match(providerSource, /mapQuickCustomerToCreatePayload/)
  assert.match(providerSource, /input\.quickCustomer/)
})
