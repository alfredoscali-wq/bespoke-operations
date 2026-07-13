import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  buildNewConsultationCreationFields,
  CONSULTATION_INTERNAL_ACTION_NEXT_STEPS,
  CONSULTATION_WAITING_NEXT_STEPS,
  CONTINUAR_GESTION_DEFAULT_RESOLUTION,
  isConsultationInternalActionNextStep,
  isConsultationWaitingNextStep,
  resolveInitialConsultationStatusFromNextStep,
  resolveLegacyResultadoFromDecision,
  validateNewConsultationInput,
} from "../lib/customer-atenciones/consultation.ts"
import {
  computeSharedInboxKpis,
  filterSharedInboxRows,
  isConsultationResolvedToday,
} from "../lib/customer-atenciones/shared-inbox.ts"
import { mapConsultaCreadaEventPayload } from "../lib/supabase/customer-atencion-events.mapper.ts"
import { mapCreateCustomerAtencionPayloadToInsert } from "../lib/supabase/customer-atenciones.mapper.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const providerPath = join(
  __dirname,
  "../components/atencion-cliente/atencion-cliente-provider.tsx"
)
const formPath = join(
  __dirname,
  "../components/atencion-cliente/atencion-form-dialog.tsx"
)
const modulePath = join(
  __dirname,
  "../components/atencion-cliente/atencion-cliente-module.tsx"
)
const migrationPath = join(
  __dirname,
  "../supabase/migrations/20261005000100_customer_atenciones_sprint_2_0.sql"
)

const referenceDate = new Date("2026-07-12T15:00:00.000Z")

const baseInput = {
  customerId: "customer-1",
  channel: "whatsapp",
  motivo: "consulta",
  detail: "Consulta por factura",
}

function inboxRow(overrides) {
  return {
    id: "row-1",
    customerId: "customer-1",
    customerName: "Juan Pérez",
    channel: "whatsapp",
    motivo: "facturacion",
    detail: "No recibió cupón",
    status: "nueva",
    nextStep: null,
    attendedByEmployeeId: "employee-1",
    attendedByEmployeeName: "Cintia",
    activeManagementEmployeeId: null,
    activeManagementEmployeeName: null,
    activeManagementStartedAt: null,
    createdAt: "2026-07-12T10:00:00.000Z",
    updatedAt: "2026-07-12T10:00:00.000Z",
    ...overrides,
  }
}

test("1. Resolver ahora → resuelta", () => {
  const fields = buildNewConsultationCreationFields({
    decision: "resolver_ahora",
    detail: baseInput.detail,
    resolution: "Se explicó el detalle de la factura",
  })

  assert.ok(!("error" in fields))
  assert.equal(fields.status, "resuelta")
})

test("2. Resolver ahora → next_step null", () => {
  const fields = buildNewConsultationCreationFields({
    decision: "resolver_ahora",
    detail: baseInput.detail,
    resolution: "Se explicó el detalle",
  })

  assert.ok(!("error" in fields))
  assert.equal(fields.nextStep, null)
})

test("3. Resolver ahora requiere resolución", () => {
  const fields = buildNewConsultationCreationFields({
    decision: "resolver_ahora",
    detail: baseInput.detail,
    resolution: "   ",
  })

  assert.ok("error" in fields)
  assert.match(fields.error, /resolución/i)

  const validation = validateNewConsultationInput({
    ...baseInput,
    decision: "resolver_ahora",
    resolution: "",
  })

  assert.match(validation ?? "", /resolución/i)
})

for (const nextStep of [
  "realizar_retencion",
  "resolver_consulta_tecnica",
  "derivar_admin_facturacion",
  "derivar_admin_morosos",
  "derivar_admin_gestion",
  "contactar_cliente",
  "seguimiento_cliente",
  "generar_ot",
]) {
  test(`4–9. Continuar + ${nextStep} → para_resolver`, () => {
    const fields = buildNewConsultationCreationFields({
      decision: "continuar_gestion",
      detail: baseInput.detail,
      nextStep,
    })

    assert.ok(!("error" in fields))
    assert.equal(fields.status, "para_resolver")
    assert.equal(fields.nextStep, nextStep)
    assert.equal(
      resolveInitialConsultationStatusFromNextStep(nextStep),
      "para_resolver"
    )
  })
}

for (const nextStep of ["esperar_cliente"]) {
  test(`10–11. Continuar + ${nextStep} → pendiente`, () => {
    const fields = buildNewConsultationCreationFields({
      decision: "continuar_gestion",
      detail: baseInput.detail,
      nextStep,
    })

    assert.ok(!("error" in fields))
    assert.equal(fields.status, "pendiente")
    assert.equal(fields.nextStep, nextStep)
  })
}

test("12. Continuar requiere next_step", () => {
  const fields = buildNewConsultationCreationFields({
    decision: "continuar_gestion",
    detail: baseInput.detail,
  })

  assert.ok("error" in fields)
  assert.match(fields.error, /próximo paso/i)
})

test("13. para_resolver requiere next_step", () => {
  const validation = validateNewConsultationInput({
    ...baseInput,
    decision: "continuar_gestion",
  })

  assert.match(validation ?? "", /próximo paso/i)
})

test("14. pendiente requiere next_step", () => {
  const fields = buildNewConsultationCreationFields({
    decision: "continuar_gestion",
    detail: baseInput.detail,
    nextStep: "esperar_cliente",
  })

  assert.ok(!("error" in fields))
  assert.equal(fields.status, "pendiente")
  assert.ok(fields.nextStep)
})

test("15. resuelta rechaza next_step", () => {
  const validation = validateNewConsultationInput({
    ...baseInput,
    decision: "resolver_ahora",
    resolution: "Resuelto",
    nextStep: "contactar_cliente",
  })

  assert.match(validation ?? "", /próximo paso/i)

  const fields = buildNewConsultationCreationFields({
    decision: "resolver_ahora",
    detail: baseInput.detail,
    resolution: "Resuelto",
  })

  assert.ok(!("error" in fields))
  assert.equal(fields.nextStep, null)
})

test("16. clasificación centralizada", () => {
  for (const step of CONSULTATION_INTERNAL_ACTION_NEXT_STEPS) {
    assert.equal(isConsultationInternalActionNextStep(step), true)
    assert.equal(isConsultationWaitingNextStep(step), false)
    assert.equal(resolveInitialConsultationStatusFromNextStep(step), "para_resolver")
  }

  for (const step of CONSULTATION_WAITING_NEXT_STEPS) {
    assert.equal(isConsultationWaitingNextStep(step), true)
    assert.equal(isConsultationInternalActionNextStep(step), false)
    assert.equal(resolveInitialConsultationStatusFromNextStep(step), "pendiente")
  }
})

test("17. no crea customer_seguimiento", () => {
  const providerSource = readFileSync(providerPath, "utf8")
  const createBlock = providerSource.slice(
    providerSource.indexOf("const createAtencion"),
    providerSource.indexOf("const createRetencion")
  )
  assert.doesNotMatch(createBlock, /createCustomerAtencionWithSeguimiento/)
  assert.doesNotMatch(createBlock, /insertCustomerSeguimiento/)
  assert.doesNotMatch(createBlock, /assignedEmployeeId/)
  assert.doesNotMatch(createBlock, /seguimiento/)
})

test("18. no asigna empleado", () => {
  const providerSource = readFileSync(providerPath, "utf8")
  const createBlock = providerSource.slice(
    providerSource.indexOf("const createAtencion"),
    providerSource.indexOf("const createRetencion")
  )
  assert.match(createBlock, /attendedByEmployeeId: employeeId/)
  assert.doesNotMatch(createBlock, /assignedEmployeeId/)
})

test("19. no crea customer_retencion", () => {
  const providerSource = readFileSync(providerPath, "utf8")
  const createBlock = providerSource.slice(
    providerSource.indexOf("const createAtencion"),
    providerSource.indexOf("const createRetencion")
  )
  assert.doesNotMatch(createBlock, /createRetencion/)
  assert.doesNotMatch(createBlock, /customer_retencion/)
})

test("20. no crea OT", () => {
  const providerSource = readFileSync(providerPath, "utf8")
  const createBlock = providerSource.slice(
    providerSource.indexOf("const createAtencion"),
    providerSource.indexOf("const createRetencion")
  )
  assert.doesNotMatch(createBlock, /generar_ot/)
  assert.doesNotMatch(createBlock, /createTask/)
  assert.doesNotMatch(createBlock, /work_order/)
})

test("21. consulta_creada conserva actor", () => {
  const fields = buildNewConsultationCreationFields({
    decision: "resolver_ahora",
    detail: baseInput.detail,
    resolution: "Resuelto en línea",
  })

  assert.ok(!("error" in fields))

  const payload = mapConsultaCreadaEventPayload({
    companyId: "company-1",
    id: "atencion-1",
    attendedByEmployeeId: "employee-1",
    status: fields.status,
    nextStep: fields.nextStep,
    createdAt: "2026-07-12T12:00:00.000Z",
  })

  assert.equal(payload.employeeId, "employee-1")
  assert.equal(payload.actionType, "consulta_creada")
})

test("22. consulta_creada conserva status inicial", () => {
  const fields = buildNewConsultationCreationFields({
    decision: "continuar_gestion",
    detail: baseInput.detail,
    nextStep: "derivar_admin_facturacion",
  })

  assert.ok(!("error" in fields))

  const payload = mapConsultaCreadaEventPayload({
    companyId: "company-1",
    id: "atencion-2",
    attendedByEmployeeId: "employee-2",
    status: fields.status,
    nextStep: fields.nextStep,
    createdAt: "2026-07-12T12:00:00.000Z",
  })

  assert.equal(payload.newStatus, "para_resolver")
})

test("23. consulta_creada conserva next_step inicial", () => {
  const fields = buildNewConsultationCreationFields({
    decision: "continuar_gestion",
    detail: baseInput.detail,
    nextStep: "esperar_cliente",
  })

  assert.ok(!("error" in fields))

  const payload = mapConsultaCreadaEventPayload({
    companyId: "company-1",
    id: "atencion-3",
    attendedByEmployeeId: "employee-1",
    status: fields.status,
    nextStep: fields.nextStep,
    createdAt: "2026-07-12T12:00:00.000Z",
  })

  assert.equal(payload.newNextStep, "esperar_cliente")
})

test("24. refresh Bandeja después de crear", () => {
  const providerSource = readFileSync(providerPath, "utf8")
  const createBlock = providerSource.slice(
    providerSource.indexOf("const createAtencion"),
    providerSource.indexOf("const createRetencion")
  )
  assert.match(createBlock, /refreshSharedInbox\(\)/)
})

test("25. refresh KPIs después de crear", () => {
  const providerSource = readFileSync(providerPath, "utf8")
  const createBlock = providerSource.slice(
    providerSource.indexOf("const createAtencion"),
    providerSource.indexOf("const createRetencion")
  )
  assert.match(createBlock, /refreshSharedInbox\(\)/)
  assert.match(providerSource, /loadSharedInboxBundle/)
})

test("26. Resuelta aparece correctamente", () => {
  const created = inboxRow({
    id: "resolved-1",
    status: "resuelta",
    updatedAt: "2026-07-12T16:00:00.000Z",
  })

  assert.equal(isConsultationResolvedToday(created, referenceDate), true)

  const filtered = filterSharedInboxRows([created], {
    statusFilter: "resuelta",
    motivo: "all",
    channel: "all",
  })

  assert.equal(filtered.length, 1)
})

test("27. Para resolver aparece correctamente", () => {
  const created = inboxRow({
    id: "action-1",
    status: "para_resolver",
    nextStep: "contactar_cliente",
  })

  const filtered = filterSharedInboxRows([created], {
    statusFilter: "para_resolver",
    motivo: "all",
    channel: "all",
  })

  assert.equal(filtered.length, 1)
  assert.equal(filtered[0]?.status, "para_resolver")
})

test("28. Pendiente aparece correctamente", () => {
  const created = inboxRow({
    id: "wait-1",
    status: "pendiente",
    nextStep: "esperar_cliente",
  })

  const filtered = filterSharedInboxRows([created], {
    statusFilter: "pendiente",
    motivo: "all",
    channel: "all",
  })

  assert.equal(filtered.length, 1)

  const kpis = computeSharedInboxKpis([created], referenceDate)
  assert.equal(kpis.pendientes, 1)
})

test("29. compatibilidad mapper", () => {
  const fields = buildNewConsultationCreationFields({
    decision: "continuar_gestion",
    detail: baseInput.detail,
    nextStep: "realizar_retencion",
  })

  assert.ok(!("error" in fields))

  const insert = mapCreateCustomerAtencionPayloadToInsert({
    companyId: "company-1",
    customerId: "customer-1",
    attendedByEmployeeId: "employee-1",
    channel: "whatsapp",
    motivo: "baja",
    detail: baseInput.detail,
    resolution: fields.resolution,
    resultado: fields.resultado,
    status: fields.status,
    nextStep: fields.nextStep,
  })

  assert.equal(insert.status, "para_resolver")
  assert.equal(insert.next_step, "realizar_retencion")
  assert.equal(insert.resultado, "requiere_seguimiento")
  assert.equal(insert.resolution, CONTINUAR_GESTION_DEFAULT_RESOLUTION)
})

test("30. compatibilidad detalle existente", () => {
  const moduleSource = readFileSync(modulePath, "utf8")
  assert.match(moduleSource, /consultation-inbox-section/i)
  assert.doesNotMatch(readFileSync(formPath, "utf8"), /requiere_seguimiento/)
})

test("31. no regresión Bandeja 2.1", () => {
  const inboxPath = join(
    __dirname,
    "../components/atencion-cliente/consultation-inbox-section.tsx"
  )
  const source = readFileSync(inboxPath, "utf8")
  assert.match(source, /ConsultationInboxSection/)
  assert.match(source, /statusFilter/)
})

test("32. no regresión Sprint 2.0", () => {
  const migrationSql = readFileSync(migrationPath, "utf8")
  assert.match(migrationSql, /customer_atenciones_record_consulta_creada_event/)
  assert.match(migrationSql, /'consulta_creada'/)
})

test("33. Equipo intacto", () => {
  const moduleSource = readFileSync(modulePath, "utf8")
  assert.match(moduleSource, /Equipo/)
  assert.match(moduleSource, /canViewEquipoReport/)
  assert.match(moduleSource, /EquipoSection/)
})

test("34. acceso módulo intacto", () => {
  const moduleSource = readFileSync(modulePath, "utf8")
  assert.match(moduleSource, /AtencionClienteModule/)
  assert.match(moduleSource, /Nueva Atención|Nueva Atencion|AtencionFormDialog/)
})

test("legacy resultado: Resolver ahora → resuelta", () => {
  assert.equal(resolveLegacyResultadoFromDecision("resolver_ahora"), "resuelta")
})

test("legacy resultado: Continuar gestión → requiere_seguimiento", () => {
  assert.equal(
    resolveLegacyResultadoFromDecision("continuar_gestion"),
    "requiere_seguimiento"
  )
})

test("formulario expone flujo Resolver ahora / Continuar gestión", () => {
  const formSource = readFileSync(formPath, "utf8")
  assert.match(formSource, /Resolver ahora/)
  assert.match(formSource, /continuar_gestion/)
  assert.match(formSource, /Guardar consulta resuelta/)
  assert.match(formSource, /Guardar para continuar/)
  assert.match(formSource, /CUSTOMER_ATENCION_NEXT_STEP_OPTIONS/)
})

test("provider usa createCustomerAtencion directo", () => {
  const providerSource = readFileSync(providerPath, "utf8")
  assert.match(providerSource, /createCustomerAtencion\(/)
  assert.match(providerSource, /validateNewConsultationInput/)
  assert.match(providerSource, /buildNewConsultationCreationFields/)
})
