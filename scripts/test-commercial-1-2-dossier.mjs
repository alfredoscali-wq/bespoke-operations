import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"

import {
  displayCommercialValue,
  formatCommercialDateOnly,
  validateCommercialOpportunityForm,
  validateCommercialPersonForm,
} from "../lib/commercial/display.ts"

test("display helpers use dash for empty values", () => {
  assert.equal(displayCommercialValue(""), "-")
  assert.equal(displayCommercialValue(null), "-")
  assert.equal(displayCommercialValue("Ana"), "Ana")
  assert.equal(formatCommercialDateOnly("2026-07-26"), "26/07/2026")
})

test("edit validations cover prospect and opportunity", () => {
  assert.equal(
    validateCommercialPersonForm({
      personType: "individual",
      firstName: "",
      lastName: "",
      companyName: "",
      phone: "",
      mobile: "",
      email: "",
      documentNumber: "",
      taxId: "",
      address: "",
      city: "",
      province: "",
      postalCode: "",
      notes: "",
    }),
    "Ingrese el nombre del prospecto."
  )

  assert.equal(
    validateCommercialOpportunityForm({
      title: "Fibra",
      assignedEmployeeId: "emp",
      source: "web",
      priority: "media",
      observations: "",
      status: "perdida",
      estimatedAmount: "",
      probability: "",
      expectedCloseDate: "",
      lostReason: "",
    }),
    "Ingrese el motivo de pérdida."
  )
})

test("dossier route and components exist", async () => {
  const page = await readFile(
    "app/(dashboard)/gestion-comercial/[id]/page.tsx",
    "utf8"
  )
  const dossier = await readFile(
    "components/gestion-comercial/commercial-dossier-module.tsx",
    "utf8"
  )
  const moduleFile = await readFile(
    "components/gestion-comercial/commercial-module.tsx",
    "utf8"
  )
  const personDrawer = await readFile(
    "components/gestion-comercial/commercial-person-drawer.tsx",
    "utf8"
  )
  const opportunityDrawer = await readFile(
    "components/gestion-comercial/commercial-opportunity-drawer.tsx",
    "utf8"
  )
  const createDrawer = await readFile(
    "components/gestion-comercial/commercial-new-opportunity-drawer.tsx",
    "utf8"
  )

  assert.match(page, /CommercialDossierModule/)
  assert.match(dossier, /CommercialHeader/)
  assert.match(dossier, /CommercialProspectCard/)
  assert.match(dossier, /CommercialOpportunityCard/)
  assert.match(dossier, /Actividad Comercial/)
  assert.match(dossier, /próximo sprint/)
  assert.match(moduleFile, /CommercialNewOpportunityDrawer/)
  assert.match(moduleFile, /gestion-comercial\/\$\{/)
  assert.match(moduleFile, /\bVer\b/)
  assert.match(personDrawer, /export function CommercialPersonDrawer/)
  assert.match(opportunityDrawer, /export function CommercialOpportunityDrawer/)
  assert.match(createDrawer, /export function CommercialNewOpportunityDrawer/)
  assert.match(personDrawer, /CommercialPersonForm/)
  assert.match(opportunityDrawer, /CommercialOpportunityForm/)
})
