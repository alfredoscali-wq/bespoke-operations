/**
 * OT 1.4 / 1.4.1 — integridad customerId en creación de OT.
 * El form conserva el id; el save reutiliza si existe y solo crea cuando falta.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  buildConsultationOtCreatePrefill,
} from "../lib/customer-atenciones/consultation-ot-create.ts"
import {
  applyCustomerToForm,
  applySolicitudPrefillToForm,
  applyWorkOrderServiceTypeChange,
} from "../lib/tasks/work-order-customer-prefill.ts"
import {
  buildWorkOrderCreatePayload,
  getDefaultWorkOrderForm,
  isNewInstallationWorkOrder,
  requiresCustomerLookup,
} from "../lib/tasks/work-order.ts"
import { shouldOfferCustomerSync } from "../lib/tasks/customer-sync.ts"
import { mapCreatePayloadToInsert } from "../lib/supabase/tasks.mapper.ts"

const root = resolve(import.meta.dirname, "..")
const dialogSource = readFileSync(
  resolve(root, "components/tareas/task-work-order-dialog.tsx"),
  "utf8"
)
const importSource = readFileSync(
  resolve(root, "lib/tasks/work-order-import/execute.ts"),
  "utf8"
)
const providerSource = readFileSync(
  resolve(root, "components/clientes/customers-provider.tsx"),
  "utf8"
)
const solicitudTypeSource = readFileSync(
  resolve(root, "lib/commercial/solicitud-ot-create.ts"),
  "utf8"
)
const customersMigration = readFileSync(
  resolve(root, "supabase/migrations/20260732000100_create_customers.sql"),
  "utf8"
)
const dniMigration = readFileSync(
  resolve(
    root,
    "supabase/migrations/20260819000100_customers_dni_sprint_clientes_2_0_1.sql"
  ),
  "utf8"
)
const onboardingRoute = readFileSync(
  resolve(root, "app/api/isp/onboarding/route.ts"),
  "utf8"
)

const handleSubmit = dialogSource.slice(
  dialogSource.indexOf("async function handleSubmit"),
  dialogSource.indexOf("async function handleConfirmSaveChanges")
)

function customerFixture() {
  return {
    id: "cust-atencion-1",
    name: "Ana Pérez",
    phone: "351111",
    email: "ana@example.com",
    address: "Av. Colón 123",
    locality: "Córdoba",
    technology: "fiber",
    sharedLocation: "https://maps.google.com/?q=-31.42,-64.18",
    latitude: -31.42,
    longitude: -64.18,
    dni: "30111222",
  }
}

test("Atención prefill transporta customers.id", () => {
  const prefill = buildConsultationOtCreatePrefill({
    atencionId: "aten-1",
    customerId: "cust-atencion-1",
    motivoLabel: "Instalación",
  })
  assert.equal(prefill.customerId, "cust-atencion-1")
})

test("applyCustomerToForm copia customerId; no copia DNI", () => {
  const patch = applyCustomerToForm(customerFixture())
  assert.equal(patch.customerId, "cust-atencion-1")
  assert.equal(patch.customerDni, undefined)
})

test("cambiar tipo a instalacion-nueva conserva customerId en el form", () => {
  const form = {
    ...getDefaultWorkOrderForm(),
    ...applyCustomerToForm(customerFixture()),
    observationsForCrew: "Consulta de origen: AT-1",
  }
  const next = applyWorkOrderServiceTypeChange(form, "instalacion-nueva")
  assert.equal(next.customerId, "cust-atencion-1")
  assert.equal(next.serviceType, "instalacion-nueva")
  assert.equal(isNewInstallationWorkOrder(next.serviceType), true)
  assert.equal(requiresCustomerLookup(next.serviceType), false)
})

test("save de instalación nueva reutiliza form.customerId y solo crea si falta", () => {
  assert.match(dialogSource, /planWorkOrderCustomerResolution/)
  const createBranch = dialogSource.slice(
    dialogSource.indexOf("if (plan.action === \"create\")"),
    dialogSource.indexOf("const customerId = plan.customerId")
  )
  assert.match(createBranch, /createCustomer\(/)
  assert.doesNotMatch(createBranch, /plan\.action === "reuse"/)
})

test("import de instalación nueva reutiliza customerId explícito", () => {
  assert.match(importSource, /planWorkOrderCustomerResolution/)
  const block = importSource.slice(
    importSource.indexOf("const customerPlan = planWorkOrderCustomerResolution"),
    importSource.indexOf("const form = importRowToFormInput")
  )
  assert.match(block, /action === "create"/)
  assert.match(block, /createCustomer\(/)
})

test("payload e insert SÍ conservarían el id si el save lo pasara", () => {
  const form = {
    ...getDefaultWorkOrderForm(),
    ...applyCustomerToForm(customerFixture()),
    serviceType: "instalacion-nueva",
    scheduledDate: "2026-08-26",
    shift: "manana",
    crewId: "crew-1",
    estimatedDurationPreset: "120",
    technology: "fiber",
    contractedPlan: "100Mb",
  }
  const payload = buildWorkOrderCreatePayload({
    form,
    existingTasks: [],
    customerId: form.customerId,
    checklist: [],
    crew: { id: "crew-1", name: "A", supervisor: "S" },
  })
  assert.equal(payload.customerId, "cust-atencion-1")
  const insert = mapCreatePayloadToInsert({
    ...payload,
    companyId: "co-1",
  })
  assert.equal(insert.customer_id, "cust-atencion-1")
})

test("Comercial sin customerId no inventa uno; con id confiable sí lo copia", () => {
  const patch = applySolicitudPrefillToForm({
    customerName: "Lead",
    customerPhone: "351000",
    address: "Calle 1",
    locality: "Córdoba",
    latitude: null,
    longitude: null,
    sharedLocation: null,
  })
  assert.equal(patch.customerId, undefined)
  assert.equal(patch.serviceType, "instalacion-nueva")
  const withId = applySolicitudPrefillToForm({
    customerName: "Lead",
    customerPhone: "351000",
    address: "Calle 1",
    locality: "Córdoba",
    latitude: null,
    longitude: null,
    sharedLocation: null,
    customerId: "cust-from-opportunity",
  })
  assert.equal(withId.customerId, "cust-from-opportunity")
  assert.match(
    solicitudTypeSource.slice(
      solicitudTypeSource.indexOf("export type SolicitudOtCreatePrefill"),
      solicitudTypeSource.indexOf("export function readTrustedCustomerId")
    ),
    /customerId\?: string/
  )
})

test("FK tasks.customer_id es opcional; DNI no es unique", () => {
  assert.match(
    customersMigration,
    /customer_id uuid REFERENCES public\.customers \(id\) ON DELETE SET NULL/
  )
  assert.match(dniMigration, /CREATE INDEX IF NOT EXISTS customers_dni_idx/)
  assert.doesNotMatch(dniMigration, /UNIQUE/)
})

test("ISP onboarding sí reutiliza existingCustomerId (contraste)", () => {
  assert.match(onboardingRoute, /createCustomer: !payload\.existingCustomerId/)
})

test("createCustomer del provider no persiste GPS", () => {
  const createFn = providerSource.slice(
    providerSource.indexOf("const createCustomer = useCallback"),
    providerSource.indexOf("const updateCustomer = useCallback")
  )
  assert.doesNotMatch(createFn, /latitude/)
  assert.doesNotMatch(createFn, /longitude/)
  assert.doesNotMatch(createFn, /sharedLocation/)
})

test("instalación nueva no ofrece sync de ficha; lookup está desactivado", () => {
  assert.equal(
    shouldOfferCustomerSync({
      customerId: "cust-atencion-1",
      serviceType: "instalacion-nueva",
    }),
    false
  )
  assert.match(dialogSource, /requiresCustomerLookup\(form\.serviceType\) && !customerSelected/)
})

test("doble click: isSubmitting se prende después de validar", () => {
  const validateIdx = handleSubmit.indexOf("await validateBeforeSave")
  const submittingIdx = handleSubmit.indexOf("setIsSubmitting(true)")
  assert.ok(validateIdx >= 0 && submittingIdx > validateIdx)
})
