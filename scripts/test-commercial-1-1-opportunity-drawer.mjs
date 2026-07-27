import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"

import {
  EXISTING_PROSPECT_NOTICE,
  isValidOptionalEmail,
  normalizeCommercialEmail,
  validateCommercialCreateOpportunityBundle,
} from "../lib/commercial/create-opportunity.ts"

test("validaciones de alta integrada", () => {
  assert.equal(
    validateCommercialCreateOpportunityBundle({
      person: {
        personType: "individual",
        firstName: "",
        lastName: "Pérez",
        companyName: "",
        phone: "",
        mobile: "",
        email: "",
      },
      opportunity: {
        title: "Fibra",
        assignedEmployeeId: "emp-1",
        source: "whatsapp",
        priority: "alta",
        observations: "",
      },
    }),
    "Ingrese el nombre del prospecto."
  )

  assert.equal(
    validateCommercialCreateOpportunityBundle({
      person: {
        personType: "company",
        firstName: "",
        lastName: "",
        companyName: "",
        phone: "",
        mobile: "",
        email: "",
      },
      opportunity: {
        title: "Fibra",
        assignedEmployeeId: "emp-1",
        source: "whatsapp",
        priority: "alta",
        observations: "",
      },
    }),
    "Ingrese la razón social del prospecto."
  )

  assert.equal(
    validateCommercialCreateOpportunityBundle({
      person: {
        personType: "individual",
        firstName: "Ana",
        lastName: "Pérez",
        companyName: "",
        phone: "",
        mobile: "",
        email: "malo",
      },
      opportunity: {
        title: "Fibra",
        assignedEmployeeId: "emp-1",
        source: "whatsapp",
        priority: "alta",
        observations: "",
      },
    }),
    "Ingrese un email válido."
  )

  assert.equal(
    validateCommercialCreateOpportunityBundle({
      person: {
        personType: "individual",
        firstName: "Ana",
        lastName: "Pérez",
        companyName: "",
        phone: "",
        mobile: "",
        email: "",
      },
      opportunity: {
        title: "Fibra",
        assignedEmployeeId: "emp-1",
        source: "whatsapp",
        priority: "alta",
        observations: "",
      },
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
    "Se encontró un prospecto existente. La oportunidad será asociada al registro actual."
  )
})

test("drawer y endpoint de alta integrada existen", async () => {
  const drawer = await readFile(
    "components/gestion-comercial/commercial-opportunity-drawer.tsx",
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

  assert.match(drawer, /CommercialOpportunityDrawer/)
  assert.match(drawer, /CommercialPersonSection/)
  assert.match(drawer, /CommercialOpportunitySection/)
  assert.match(drawer, /CommercialDrawerFooter/)
  assert.match(drawer, /DiscardChangesDialog/)
  assert.match(moduleFile, /Nueva Oportunidad/)
  assert.match(moduleFile, /CommercialOpportunityDrawer/)
  assert.match(moduleFile, /Oportunidad creada correctamente/)
  assert.match(route, /createWithPerson/)
  assert.match(services, /createWithPerson/)
  assert.match(services, /softDelete/)
  assert.match(services, /matchedExistingPerson/)
})
