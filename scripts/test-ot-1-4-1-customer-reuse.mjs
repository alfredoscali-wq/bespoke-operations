/**
 * OT 1.4.1 — reutilizar customerId existente al crear OT de instalación nueva.
 */
import assert from "node:assert/strict"
import { mock } from "node:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  buildConsultationOtCreatePrefill,
} from "../lib/customer-atenciones/consultation-ot-create.ts"
import {
  applySolicitudPrefillToForm,
  applyCustomerToForm,
  applyWorkOrderServiceTypeChange,
} from "../lib/tasks/work-order-customer-prefill.ts"
import {
  applyReusedExistingCustomerMetadata,
  planWorkOrderCustomerResolution,
} from "../lib/tasks/work-order-customer-resolve.ts"
import {
  buildWorkOrderCreatePayload,
  buildWorkOrderUpdatePayload,
  getDefaultWorkOrderForm,
} from "../lib/tasks/work-order.ts"
import {
  buildCustomerUpdateFromApprovedTask,
  shouldSetPendingActivationOnInstallation,
} from "../lib/tasks/work-order-approval-effects.ts"
import { mapCreatePayloadToInsert } from "../lib/supabase/tasks.mapper.ts"
import { readTrustedCustomerId } from "../lib/commercial/solicitud-ot-create.ts"
import { executeWorkOrderImport } from "../lib/tasks/work-order-import/execute.ts"
import { getEmptyImportRowData } from "../lib/tasks/work-order-import/columns.ts"
import { applyValidationToRow } from "../lib/tasks/work-order-import/validate.ts"

const root = resolve(import.meta.dirname, "..")
const dialogSource = readFileSync(
  resolve(root, "components/tareas/task-work-order-dialog.tsx"),
  "utf8"
)
const importSource = readFileSync(
  resolve(root, "lib/tasks/work-order-import/execute.ts"),
  "utf8"
)
const linkSql = readFileSync(
  resolve(
    root,
    "supabase/migrations/20261023000100_customer_atenciones_ot_link_resolves_rc_3_2_7.sql"
  ),
  "utf8"
)
const dossierSource = readFileSync(
  resolve(root, "components/gestion-comercial/commercial-dossier-module.tsx"),
  "utf8"
)

const CUSTOMER_ID = "cust-existing-1"

function customerFixture(overrides = {}) {
  return {
    id: CUSTOMER_ID,
    name: "Ana Pérez",
    phone: "351111",
    email: "ana@example.com",
    address: "Av. Colón 123",
    locality: "Córdoba",
    technology: "fiber",
    sharedLocation: "",
    latitude: -31.42,
    longitude: -64.18,
    ...overrides,
  }
}

function installationForm(overrides = {}) {
  return {
    ...getDefaultWorkOrderForm(),
    ...applyCustomerToForm(customerFixture()),
    serviceType: "instalacion-nueva",
    scheduledDate: "2026-08-26",
    shift: "manana",
    crewId: "crew-1",
    estimatedDurationPreset: "120",
    technology: "fiber",
    contractedPlan: "100Mb",
    ...overrides,
  }
}

function payloadFor(form, customerId = form.customerId) {
  return buildWorkOrderCreatePayload({
    form,
    existingTasks: [],
    customerId,
    checklist: [],
    crew: { id: "crew-1", name: "A", supervisor: "S" },
  })
}

function approvalCustomer(status = "activo") {
  return {
    id: CUSTOMER_ID,
    customerNumber: "CLI-000001",
    name: "Ana Pérez",
    address: "Av. Colón 123",
    locality: "Córdoba",
    technology: "fiber",
    status,
    validationStatus: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
}

function approvalTask(metadata = {}) {
  return {
    id: "task-1",
    code: "TSK-OT-1",
    title: "Instalación Nueva",
    description: "",
    projectCode: "OT",
    projectName: "Ana",
    customerId: CUSTOMER_ID,
    serviceAddress: "Av. Colón 123",
    locality: "Córdoba",
    type: "fiber",
    status: "en-aprobacion",
    priority: "media",
    supervisor: "S",
    crew: "A",
    startDate: "2026-08-26",
    dueDate: "2026-08-26",
    estimatedDuration: "120",
    checklist: [],
    progress: 100,
    serviceType: "instalacion-nueva",
    contractedPlan: "100Mb",
    taskMetadata: { technology: "fiber", ...metadata },
  }
}

function importRow(overrides = {}) {
  return {
    id: "row-1",
    rowNumber: 2,
    selected: true,
    status: "valid",
    issues: [],
    data: {
      ...getEmptyImportRowData(),
      serviceType: "instalacion-nueva",
      customerName: "Ana Pérez",
      address: "Av. Colón 123",
      locality: "Córdoba",
      technology: "fiber",
      scheduledDate: "2026-08-26",
      ...overrides,
    },
  }
}

test("1 Atención + cliente existente + instalación nueva reutiliza customerId", () => {
  const prefill = buildConsultationOtCreatePrefill({
    atencionId: "aten-1",
    customerId: CUSTOMER_ID,
    motivoLabel: "Alta",
  })
  const form = installationForm({
    ...applyCustomerToForm(customerFixture({ id: prefill.customerId })),
  })
  const plan = planWorkOrderCustomerResolution({
    serviceType: form.serviceType,
    formCustomerId: form.customerId,
    isEditMode: false,
  })
  assert.deepEqual(plan, { action: "reuse", customerId: CUSTOMER_ID })
  const payload = payloadFor(form)
  assert.equal(payload.customerId, CUSTOMER_ID)
  assert.equal(payload.taskMetadata?.reusedExistingCustomer, true)
})

test("2 Nueva OT + cliente existente + instalación nueva reutiliza customerId", () => {
  const afterSelect = {
    ...getDefaultWorkOrderForm(),
    ...applyCustomerToForm(customerFixture()),
  }
  const form = applyWorkOrderServiceTypeChange(afterSelect, "instalacion-nueva")
  const plan = planWorkOrderCustomerResolution({
    serviceType: form.serviceType,
    formCustomerId: form.customerId,
    isEditMode: false,
  })
  assert.deepEqual(plan, { action: "reuse", customerId: CUSTOMER_ID })
})

test("3 instalación nueva sin customerId mantiene creación", () => {
  const plan = planWorkOrderCustomerResolution({
    serviceType: "instalacion-nueva",
    formCustomerId: "",
    isEditMode: false,
  })
  assert.equal(plan.action, "create")
  const payload = payloadFor(installationForm({ customerId: "" }), "cust-created-2")
  assert.equal(payload.customerId, "cust-created-2")
  assert.equal(payload.taskMetadata?.reusedExistingCustomer, undefined)
})

test("4 cambio de tipo después de seleccionar cliente mantiene customerId", () => {
  const selected = {
    ...getDefaultWorkOrderForm(),
    ...applyCustomerToForm(customerFixture()),
  }
  const next = applyWorkOrderServiceTypeChange(selected, "instalacion-nueva")
  assert.equal(next.customerId, CUSTOMER_ID)
  assert.equal(
    planWorkOrderCustomerResolution({
      serviceType: next.serviceType,
      formCustomerId: next.customerId,
      isEditMode: false,
    }).action,
    "reuse"
  )
})

test("5 cliente activo reutilizado NO pasa a pendiente-activacion", () => {
  const reused = approvalTask({ reusedExistingCustomer: true })
  assert.equal(
    shouldSetPendingActivationOnInstallation(approvalCustomer("activo"), reused),
    false
  )
  const update = buildCustomerUpdateFromApprovedTask(
    reused,
    approvalCustomer("activo")
  )
  assert.ok(update)
  assert.equal(update.status, undefined)

  const created = approvalTask({})
  assert.equal(
    shouldSetPendingActivationOnInstallation(approvalCustomer("activo"), created),
    true
  )
  const createdUpdate = buildCustomerUpdateFromApprovedTask(
    created,
    approvalCustomer("activo")
  )
  assert.equal(createdUpdate?.status, "pendiente-activacion")
})

test("6 Comercial con customerId lo conserva hasta la OT", () => {
  assert.equal(readTrustedCustomerId("  cust-from-opportunity  "), "cust-from-opportunity")
  const form = applySolicitudPrefillToForm({
    customerName: "Lead",
    customerPhone: "351000",
    address: "Calle 1",
    locality: "Córdoba",
    latitude: null,
    longitude: null,
    sharedLocation: null,
    customerId: "cust-from-opportunity",
  })
  assert.equal(form.customerId, "cust-from-opportunity")
  assert.equal(
    planWorkOrderCustomerResolution({
      serviceType: form.serviceType,
      formCustomerId: form.customerId,
      isEditMode: false,
    }).action,
    "reuse"
  )
  assert.match(dossierSource, /sourceCustomerId/)
  assert.match(dossierSource, /readTrustedCustomerId/)
})

test("7 Comercial sin customerId mantiene creación", () => {
  assert.equal(readTrustedCustomerId(null), "")
  assert.equal(readTrustedCustomerId("   "), "")
  const form = applySolicitudPrefillToForm({
    customerName: "Lead",
    customerPhone: "351000",
    address: "Calle 1",
    locality: "Córdoba",
    latitude: null,
    longitude: null,
    sharedLocation: null,
  })
  assert.equal(form.customerId, undefined)
  assert.equal(
    planWorkOrderCustomerResolution({
      serviceType: "instalacion-nueva",
      formCustomerId: form.customerId,
      isEditMode: false,
    }).action,
    "create"
  )
})

test("8-9 import con y sin customerId", async () => {
  const created = []
  const payloads = []
  const createCustomer = mock.fn(async () => {
    created.push("new")
    return {
      success: true,
      customer: {
        id: "cust-created-2",
        customerNumber: "CLI-000002",
        name: "Ana Pérez",
        status: "activo",
        validationStatus: "active",
        createdAt: "",
        updatedAt: "",
      },
    }
  })
  const addTask = mock.fn(async (payload) => {
    payloads.push(payload)
    return { id: "task-1", code: "TSK-OT-1", ...payload }
  })

  await executeWorkOrderImport({
    rows: [importRow({ customerId: CUSTOMER_ID })],
    existingTasks: [],
    customers: [],
    crews: [],
    createCustomer,
    addTask,
  })
  assert.equal(createCustomer.mock.callCount(), 0)
  assert.equal(payloads[0].customerId, CUSTOMER_ID)
  assert.equal(payloads[0].taskMetadata?.reusedExistingCustomer, true)

  await executeWorkOrderImport({
    rows: [importRow({ customerId: "" })],
    existingTasks: [],
    customers: [],
    crews: [],
    createCustomer,
    addTask,
  })
  assert.equal(createCustomer.mock.callCount(), 1)
  assert.equal(payloads[1].customerId, "cust-created-2")
  assert.equal(payloads[1].taskMetadata?.reusedExistingCustomer, undefined)
})

test("10 OT creada queda vinculada al cliente correcto en el insert", () => {
  const payload = payloadFor(installationForm())
  const insert = mapCreatePayloadToInsert({ ...payload, companyId: "co-1" })
  assert.equal(insert.customer_id, CUSTOMER_ID)
})

test("11 Atención sigue vinculada al mismo cliente; el link de OT no reescribe customer_id", () => {
  assert.doesNotMatch(linkSql, /customer_id\s*=/)
  const plan = planWorkOrderCustomerResolution({
    serviceType: "instalacion-nueva",
    formCustomerId: CUSTOMER_ID,
    isEditMode: false,
  })
  assert.equal(plan.action, "reuse")
  assert.equal(plan.action === "reuse" ? plan.customerId : "", CUSTOMER_ID)
})

test("12 no se llama createCustomer cuando customerId es válido", () => {
  const createBranch = dialogSource.slice(
    dialogSource.indexOf('if (plan.action === "create")'),
    dialogSource.indexOf("const customerId = plan.customerId")
  )
  assert.match(dialogSource, /planWorkOrderCustomerResolution/)
  assert.match(createBranch, /createCustomer\(/)
  assert.equal(
    planWorkOrderCustomerResolution({
      serviceType: "instalacion-nueva",
      formCustomerId: CUSTOMER_ID,
      isEditMode: false,
    }).action,
    "reuse"
  )
  assert.match(importSource, /planWorkOrderCustomerResolution/)
})

test("validación de import conserva customer_id explícito de instalación nueva", () => {
  const reviewed = applyValidationToRow(
    importRow({ customerId: CUSTOMER_ID, customerName: "Ana Pérez" }),
    { customers: [], crews: [] }
  )
  assert.equal(reviewed.data.customerId, CUSTOMER_ID)
})

test("edición no infiere reusedExistingCustomer si la OT nació con cliente nuevo", () => {
  const form = installationForm({ customerId: "cust-created-2" })
  const createdTask = {
    ...approvalTask({}),
    customerId: "cust-created-2",
    taskMetadata: { technology: "fiber" },
    checklist: [],
  }
  const update = buildWorkOrderUpdatePayload({
    form,
    task: createdTask,
    existingTasks: [],
    customerId: "cust-created-2",
    crew: { id: "crew-1", name: "A", supervisor: "S" },
  })
  assert.equal(update.taskMetadata?.reusedExistingCustomer, undefined)

  const reusedTask = {
    ...createdTask,
    customerId: CUSTOMER_ID,
    taskMetadata: { technology: "fiber", reusedExistingCustomer: true },
  }
  const reusedUpdate = buildWorkOrderUpdatePayload({
    form: installationForm(),
    task: reusedTask,
    existingTasks: [],
    customerId: CUSTOMER_ID,
    crew: { id: "crew-1", name: "A", supervisor: "S" },
  })
  assert.equal(reusedUpdate.taskMetadata?.reusedExistingCustomer, true)
})

test("applyReusedExistingCustomerMetadata solo marca instalación reutilizada", () => {
  const metadata = applyReusedExistingCustomerMetadata(
    { technology: "fiber" },
    {
      serviceType: "instalacion-nueva",
      formCustomerId: CUSTOMER_ID,
      resolvedCustomerId: CUSTOMER_ID,
    }
  )
  assert.equal(metadata.reusedExistingCustomer, true)
})
