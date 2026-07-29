import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"

import {
  EXISTING_PROSPECT_NOTICE,
  isValidOptionalEmail,
  normalizeCommercialEmail,
  validateCommercialCreateOpportunityBundle,
} from "../lib/commercial/create-opportunity.ts"

const basePerson = {
  personType: "individual",
  firstName: "Ana",
  lastName: "Pérez",
  companyName: "",
  documentNumber: "",
  phone: "111",
  mobile: "111",
  email: "",
  street: "",
  streetNumber: "",
  floor: "",
  apartment: "",
  neighborhood: "",
  city: "",
  province: "",
  postalCode: "",
  address: "",
  latitude: null,
  longitude: null,
  locationSource: null,
  locationInput: "",
}

const baseOpportunity = {
  title: "Ana Pérez",
  assignedEmployeeId: "emp-1",
  source: "whatsapp",
  priority: "alta",
  observations: "",
  etiquetaId: "etiq-1",
  latitude: null,
  longitude: null,
  locationSource: null,
}

test("validaciones de alta integrada", () => {
  assert.equal(
    validateCommercialCreateOpportunityBundle({
      person: { ...basePerson, firstName: "", lastName: "Pérez", phone: "111" },
      opportunity: baseOpportunity,
    }),
    "Ingrese el nombre y apellido del cliente."
  )

  assert.equal(
    validateCommercialCreateOpportunityBundle({
      person: {
        ...basePerson,
        personType: "company",
        firstName: "",
        lastName: "",
        companyName: "",
      },
      opportunity: baseOpportunity,
    }),
    "Ingrese la razón social del cliente."
  )

  assert.equal(
    validateCommercialCreateOpportunityBundle({
      person: { ...basePerson, email: "malo" },
      opportunity: baseOpportunity,
    }),
    "Ingrese un email válido."
  )

  assert.equal(
    validateCommercialCreateOpportunityBundle({
      person: { ...basePerson, phone: "", mobile: "" },
      opportunity: baseOpportunity,
    }),
    "Ingrese el teléfono del cliente."
  )

  assert.equal(
    validateCommercialCreateOpportunityBundle({
      person: basePerson,
      opportunity: { ...baseOpportunity, etiquetaId: "" },
    }),
    "Seleccione una etiqueta."
  )

  assert.equal(
    validateCommercialCreateOpportunityBundle({
      person: basePerson,
      opportunity: baseOpportunity,
    }),
    null
  )
})

test("email opcional y normalización", () => {
  assert.equal(isValidOptionalEmail(""), true)
  assert.equal(isValidOptionalEmail("  "), true)
  assert.equal(isValidOptionalEmail("ana@acme.com"), true)
  assert.equal(isValidOptionalEmail("ana"), false)
  assert.equal(normalizeCommercialEmail(" Ana@Acme.COM "), "ana@acme.com")
  assert.equal(
    EXISTING_PROSPECT_NOTICE,
    "Se encontró un cliente existente. El alta se asociará al registro actual."
  )
})

test("drawer y endpoint de alta integrada existen", async () => {
  const drawer = await readFile(
    "components/gestion-comercial/commercial-new-opportunity-drawer.tsx",
    "utf8"
  )
  const moduleFile = await readFile(
    "components/gestion-comercial/commercial-module.tsx",
    "utf8"
  )
  const route = await readFile(
    "app/api/gestion-comercial/opportunities/with-person/route.ts",
    "utf8"
  )
  const services = await readFile("lib/commercial/services.ts", "utf8")

  assert.match(drawer, /Nuevo Cliente/)
  assert.match(drawer, /SharedLocationInput/)
  assert.match(drawer, /etiqueta/)
  assert.match(moduleFile, /CommercialNewOpportunityDrawer/)
  assert.match(route, /createWithPerson/)
  assert.match(services, /createWithPerson/)
})
