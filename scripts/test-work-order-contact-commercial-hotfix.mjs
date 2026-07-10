import assert from "node:assert/strict"
import test from "node:test"

import {
  formatWorkOrderPaymentMethodLabel,
  resolvePaymentMethodFromForm,
} from "../lib/tasks/commercial-plan.ts"
import {
  buildWorkOrderCreatePayload,
  getDefaultWorkOrderForm,
} from "../lib/tasks/work-order.ts"
import {
  mapCreatePayloadToInsert,
  mapTaskRowToTask,
} from "../lib/supabase/tasks.mapper.ts"

const baseInstallationForm = {
  ...getDefaultWorkOrderForm(),
  serviceType: "instalacion-nueva",
  customerName: "Juan Pérez",
  customerPhone: "3515551234",
  customerDni: "30123456",
  customerEmail: "juan@example.com",
  address: "Calle 123",
  locality: "Centro",
  technology: "fiber",
  contractedPlan: "100Mb",
  scheduledDate: "2026-07-10",
  shift: "manana",
  crewId: "crew-1",
  estimatedDurationPreset: "90",
  amountToCollect: "15000",
  paymentMethod: "transferencia",
}

test("teléfono manual persiste en customer_phone de la OT", () => {
  const payload = buildWorkOrderCreatePayload({
    form: {
      ...getDefaultWorkOrderForm(),
      serviceType: "service-tecnico",
      customerName: "Cliente sin teléfono",
      customerPhone: "3515559999",
      customerId: "customer-1",
      address: "Av. Siempre Viva 742",
      serviceReason: "sin-conexion",
      serviceDetail: "Sin servicio",
      scheduledDate: "2026-07-10",
      shift: "manana",
      crewId: "crew-1",
      estimatedDurationPreset: "45",
    },
    existingTasks: [],
    customerId: "customer-1",
    checklist: [],
  })

  assert.equal(payload.customerPhone, "3515559999")

  const insert = mapCreatePayloadToInsert({
    ...payload,
    description: payload.description ?? "",
    progress: 0,
  })

  assert.equal(insert.customer_phone, "3515559999")
})

test("teléfono vacío no bloquea payload de creación", () => {
  const payload = buildWorkOrderCreatePayload({
    form: {
      ...getDefaultWorkOrderForm(),
      serviceType: "baja",
      customerName: "Cliente",
      customerPhone: "",
      customerId: "customer-2",
      cancellationReason: "Mudanza",
      scheduledDate: "2026-07-10",
      shift: "tarde",
      crewId: "crew-1",
      estimatedDurationPreset: "45",
    },
    existingTasks: [],
    customerId: "customer-2",
    checklist: [],
  })

  assert.equal(payload.customerPhone, undefined)
})

test("Nueva Instalación persiste DNI / CUIT y medio de pago", () => {
  const payload = buildWorkOrderCreatePayload({
    form: baseInstallationForm,
    existingTasks: [],
    customerId: "customer-new",
    checklist: [],
  })

  assert.equal(payload.customerDni, "30123456")
  assert.equal(payload.paymentMethod, "transferencia")
  assert.equal(payload.amountToCollect, 15000)

  const insert = mapCreatePayloadToInsert({
    ...payload,
    description: payload.description ?? "",
    progress: 0,
  })

  assert.equal(insert.customer_dni, "30123456")
  assert.equal(insert.payment_method, "transferencia")
  assert.equal(Number(insert.amount_to_collect), 15000)
})

test("mapper mapea OT existente sin campos nuevos", () => {
  const task = mapTaskRowToTask({
    id: "task-1",
    company_id: "company-1",
    code: "OT-001",
    title: "Service Técnico",
    description: "",
    project_id: null,
    project_code: "OT",
    project_name: "Cliente",
    customer_company: null,
    customer_name: "Cliente",
    customer_phone: "3515550000",
    customer_dni: null,
    customer_id: "customer-1",
    service_address: "Calle 1",
    latitude: null,
    longitude: null,
    location_resolution_method: null,
    shared_location: "",
    observations_for_crew: "",
    rejection_reason: "",
    incident_reason: "",
    incident_observation: "",
    incident_reported_at: null,
    incident_reported_by: "",
    cancellation_reason: "",
    cancellation_observation: "",
    work_order_number: null,
    type: "maintenance",
    status: "programada",
    priority: "media",
    supervisor: "Supervisor",
    crew_id: null,
    crew: "",
    start_date: "2026-07-10",
    due_date: "2026-07-10",
    scheduled_time: null,
    original_scheduled_date: null,
    original_scheduled_time: null,
    rescheduled_by: "",
    rescheduled_at: null,
    reschedule_reason: "",
    reschedule_notes: "",
    estimated_duration: "45 min",
    checklist: [],
    operational_steps: [],
    progress: 0,
    created_at: "2026-07-10T12:00:00.000Z",
    updated_at: "2026-07-10T12:00:00.000Z",
    completed_at: null,
    closed_at: null,
    deleted_at: null,
    service_type: "service-tecnico",
    locality: null,
    contracted_plan: null,
    installation_cost: null,
    amount_to_collect: null,
    payment_method: null,
    task_metadata: {},
    execution_order: null,
    dispatch_order: null,
  })

  assert.equal(task.customerPhone, "3515550000")
  assert.equal(task.customerDni, undefined)
  assert.equal(task.paymentMethod, undefined)
})

test("catálogo mínimo de medios de pago", () => {
  assert.equal(resolvePaymentMethodFromForm("efectivo"), "efectivo")
  assert.equal(
    formatWorkOrderPaymentMethodLabel("mercadopago"),
    "Mercado Pago"
  )
  assert.equal(resolvePaymentMethodFromForm(""), undefined)
})
