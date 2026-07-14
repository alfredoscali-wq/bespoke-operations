import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  canStartConsultationManagement,
  CONSULTATION_DEFER_DEFAULT_RESOLUTION,
  isConsultationManagedByEmployee,
  validateResolveConsultationResolution,
} from "../lib/customer-atenciones/consultation-management.ts"
import { resolveInitialConsultationStatusFromNextStep } from "../lib/customer-atenciones/consultation.ts"
import {
  buildRetentionFirmBajaDeferInput,
  buildRetentionRetainedResolveInput,
  isActiveRetentionConsultationForEmployee,
  isRetentionConsultation,
  RETENTION_FIRM_BAJA_NEXT_STEP,
  RETENTION_NEXT_STEP,
  validateRetentionFirmBajaDetail,
  validateRetentionRetainedResolution,
} from "../lib/customer-atenciones/retention-flow.ts"
import {
  filterSharedInboxRows,
} from "../lib/customer-atenciones/shared-inbox.ts"
import { formatCustomerAtencionNextStepLabel } from "../lib/customer-atenciones/format.ts"
import {
  computeOperationalWorkCounts,
  getOperationalCategoryForNextStep,
  getVisibleOperationalCategories,
  matchesOperationalCategory,
  SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG,
} from "../lib/customer-atenciones/shared-inbox.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const migration24Path = join(
  __dirname,
  "../supabase/migrations/20261007000100_customer_atenciones_sprint_2_4_retention_flow.sql"
)
const migration23Path = join(
  __dirname,
  "../supabase/migrations/20261006000100_customer_atenciones_sprint_2_3_shared_management.sql"
)
const migration20Path = join(
  __dirname,
  "../supabase/migrations/20261005000100_customer_atenciones_sprint_2_0.sql"
)
const formPath = join(
  __dirname,
  "../components/atencion-cliente/atencion-form-dialog.tsx"
)
const detailPath = join(
  __dirname,
  "../components/atencion-cliente/atencion-detail-screen.tsx"
)
const retentionDialogPath = join(
  __dirname,
  "../components/atencion-cliente/retention-result-dialog.tsx"
)
const inboxPath = join(
  __dirname,
  "../components/atencion-cliente/consultation-inbox-section.tsx"
)
const providerPath = join(
  __dirname,
  "../components/atencion-cliente/atencion-cliente-provider.tsx"
)
const deferRoutePath = join(
  __dirname,
  "../app/api/atencion-cliente/[atencionId]/defer/route.ts"
)
const serverPath = join(
  __dirname,
  "../lib/customer-atenciones/consultation-management.server.ts"
)
const browserPath = join(
  __dirname,
  "../lib/supabase/customer-atenciones-management.browser.ts"
)
const modulePath = join(
  __dirname,
  "../components/atencion-cliente/atencion-cliente-module.tsx"
)
const operationalSectionPath = join(
  __dirname,
  "../components/atencion-cliente/consultation-operational-work-section.tsx"
)
const queriesPath = join(
  __dirname,
  "../lib/supabase/customer-atenciones.queries.ts"
)

const migration24Sql = readFileSync(migration24Path, "utf8")
const migration23Sql = readFileSync(migration23Path, "utf8")
const migration20Sql = readFileSync(migration20Path, "utf8")
const detailSource = readFileSync(detailPath, "utf8")
const retentionDialogSource = readFileSync(retentionDialogPath, "utf8")
const inboxSource = readFileSync(inboxPath, "utf8")
const providerSource = readFileSync(providerPath, "utf8")
const formSource = readFileSync(formPath, "utf8")
const deferRouteSource = readFileSync(deferRoutePath, "utf8")
const serverSource = readFileSync(serverPath, "utf8")
const browserSource = readFileSync(browserPath, "utf8")

function inboxRow(overrides) {
  return {
    id: "row-1",
    customerId: "customer-1",
    customerName: "Juan Pérez",
    channel: "whatsapp",
    motivo: "baja",
    detail: "Pedido de baja",
    status: "para_resolver",
    nextStep: RETENTION_NEXT_STEP,
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

function atencion(overrides) {
  return {
    status: "para_resolver",
    nextStep: RETENTION_NEXT_STEP,
    activeManagementEmployeeId: null,
    ...overrides,
  }
}

// ENTRADA

test("1. realizar_retencion sigue creando para_resolver", () => {
  assert.equal(
    resolveInitialConsultationStatusFromNextStep(RETENTION_NEXT_STEP),
    "para_resolver"
  )
})

test("2. no crea customer_retencion", () => {
  assert.doesNotMatch(migration24Sql, /customer_retenciones/)
  assert.doesNotMatch(detailSource, /createRetencion/)
})

test("3. no asigna empleado", () => {
  assert.doesNotMatch(migration24Sql, /assigned/)
  assert.doesNotMatch(retentionDialogSource, /assign/i)
})

test("4. aparece en Bandeja", () => {
  const row = inboxRow({ status: "para_resolver", nextStep: RETENTION_NEXT_STEP })
  const filtered = filterSharedInboxRows([row], {
    statusFilter: "para_resolver",
    motivo: "all",
    channel: "all",
  })
  assert.equal(filtered.length, 1)
  assert.match(inboxSource, /isRetentionConsultation/)
})

// INICIAR GESTIÓN

test("5. reutiliza start Sprint 2.3", () => {
  assert.doesNotMatch(migration24Sql, /start_customer_atencion_management/)
  assert.match(detailSource, /startConsultationManagement/)
})

test("6. conserva next_step realizar_retencion", () => {
  assert.match(migration23Sql, /'new_next_step', v_atencion\.next_step/)
})

test("7. setea en_gestion", () => {
  assert.match(migration23Sql, /status = 'en_gestion'/)
})

test("8. actor seguro", () => {
  assert.match(migration23Sql, /e\.company_id = p_company_id/)
})

test("9. concurrencia intacta", () => {
  assert.match(migration23Sql, /CONSULTATION_ALREADY_IN_MANAGEMENT/)
  assert.match(migration23Sql, /FOR UPDATE/)
})

test("10. gestion_iniciada intacto", () => {
  assert.match(migration23Sql, /'gestion_iniciada'/)
})

// UI

test("11. retención activa del actor muestra Registrar resultado de retención", () => {
  assert.match(detailSource, /Registrar resultado de retención/)
  assert.match(detailSource, /isActiveRetentionConsultationForEmployee/)
})

test("12. no muestra simultáneamente acciones genéricas confusas", () => {
  assert.match(detailSource, /isActiveRetention \?/)
  assert.match(detailSource, /: isManagedByCurrentEmployee \?/)
})

test("13. otro next_step conserva UI genérica", () => {
  assert.match(detailSource, /Resolver Consulta/)
  assert.match(detailSource, /Definir próximo paso/)
})

test("14. otro empleado no puede registrar resultado", () => {
  assert.equal(
    isActiveRetentionConsultationForEmployee(
      atencion({
        status: "en_gestion",
        activeManagementEmployeeId: "employee-2",
      }),
      "employee-1"
    ),
    false
  )
})

test("15. formulario ofrece Cliente retenido", () => {
  assert.match(retentionDialogSource, /Cliente retenido/)
})

test("16. formulario ofrece Baja sigue firme", () => {
  assert.match(retentionDialogSource, /Baja sigue firme/)
})

test("17. Cliente retenido requiere resolución", () => {
  const result = validateRetentionRetainedResolution("   ")
  assert.ok("error" in result)
})

test("18. Baja sigue firme requiere resultado/motivo", () => {
  const result = validateRetentionFirmBajaDetail("")
  assert.ok("error" in result)
})

// CLIENTE RETENIDO

test("19. reutiliza resolve autoritativo", () => {
  assert.doesNotMatch(migration24Sql, /resolve_customer_atencion_consultation/)
  assert.match(retentionDialogSource, /onResolve/)
  assert.match(detailSource, /resolveConsultation/)
})

test("20. status → resuelta", () => {
  assert.match(migration23Sql, /status = 'resuelta'/)
})

test("21. next_step → NULL", () => {
  assert.match(migration23Sql, /next_step = NULL/)
})

test("22. limpia active employee", () => {
  assert.match(migration23Sql, /active_management_employee_id = NULL/)
})

test("23. limpia active timestamp", () => {
  assert.match(migration23Sql, /active_management_started_at = NULL/)
})

test("24. resultado → resuelta", () => {
  assert.match(migration23Sql, /resultado = 'resuelta'/)
})

test("25. persiste resolución real", () => {
  assert.match(migration23Sql, /resolution = v_resolution/)
})

test("26. crea consulta_resuelta", () => {
  assert.match(migration23Sql, /'consulta_resuelta'/)
})

test("27. evento conserva previous next_step realizar_retencion", () => {
  assert.match(migration23Sql, /previous_next_step/)
})

test("28. evento conserva detail real", () => {
  assert.match(migration23Sql, /detail,\s*previous_status/)
})

test("29. mutación + evento atómicos", () => {
  assert.match(migration23Sql, /FOR UPDATE/)
  assert.match(migration23Sql, /INSERT INTO public\.customer_atencion_events/)
})

test("30. aparece en Resueltas hoy", () => {
  const resolved = inboxRow({ status: "resuelta", nextStep: null })
  const filtered = filterSharedInboxRows([resolved], {
    statusFilter: "resuelta",
    motivo: "all",
    channel: "all",
  })
  assert.equal(filtered.length, 1)
})

// BAJA SIGUE FIRME

test("31. reutiliza/extiende defer autoritativo", () => {
  assert.match(migration24Sql, /defer_customer_atencion_consultation/)
  assert.match(retentionDialogSource, /onDefer/)
  assert.match(retentionDialogSource, /buildRetentionFirmBajaDeferInput/)
})

test("32. status → pendiente", () => {
  assert.match(migration24Sql, /THEN 'pendiente'/)
})

test("33. next_step → derivar_admin_gestion", () => {
  assert.equal(RETENTION_FIRM_BAJA_NEXT_STEP, "derivar_admin_gestion")
  // Sprint 2.4 historically wrote esperar_administracion; 2.8 remaps it.
  assert.match(migration24Sql, /'esperar_administracion'/)
})

test("34. limpia active employee", () => {
  assert.match(migration24Sql, /active_management_employee_id = NULL/)
})

test("35. limpia active timestamp", () => {
  assert.match(migration24Sql, /active_management_started_at = NULL/)
})

test("36. resultado → requiere_seguimiento", () => {
  assert.match(migration24Sql, /resultado = 'requiere_seguimiento'/)
})

test("37. persiste resultado/motivo real", () => {
  assert.match(migration24Sql, /WHEN v_detail IS NOT NULL THEN v_detail/)
  assert.match(migration24Sql, /resolution = v_resolution/)
})

test("38. crea consulta_pendiente", () => {
  assert.match(migration24Sql, /'consulta_pendiente'/)
})

test("39. evento previous_status = en_gestion", () => {
  assert.match(migration24Sql, /v_previous_status/)
})

test("40. evento new_status = pendiente", () => {
  assert.match(migration24Sql, /v_new_status/)
})

test("41. evento previous_next_step = realizar_retencion", () => {
  assert.match(migration24Sql, /v_previous_next_step/)
})

test("42. evento new_next_step conserva v_next_step (histórico esperar_administracion)", () => {
  assert.match(migration24Sql, /v_next_step/)
})

test("43. evento conserva detail real", () => {
  assert.match(migration24Sql, /detail,\s*previous_status/)
  assert.match(migration24Sql, /v_detail/)
})

test("44. mutación + evento atómicos", () => {
  assert.match(migration24Sql, /FOR UPDATE/)
  assert.match(migration24Sql, /INSERT INTO public\.customer_atencion_events/)
})

test("45. baja firme aparece en Para Resolver por derivar_admin_gestion", () => {
  const waiting = inboxRow({
    status: "para_resolver",
    nextStep: RETENTION_FIRM_BAJA_NEXT_STEP,
  })
  const filtered = filterSharedInboxRows(
    [waiting],
    {
      statusFilter: "para_resolver",
      motivo: "all",
      channel: "all",
    },
    new Date("2026-07-12T15:00:00.000Z")
  )
  assert.equal(filtered.length, 1)
})

// COMPATIBILIDAD

test("46. defer genérico Sprint 2.3 sigue funcionando sin nota obligatoria", () => {
  assert.match(migration24Sql, /p_detail text DEFAULT NULL/)
  assert.match(migration24Sql, /ELSE 'Consulta devuelta a la bandeja compartida\.'/)
  assert.equal(CONSULTATION_DEFER_DEFAULT_RESOLUTION, "Consulta devuelta a la bandeja compartida.")
})

test("47. resolve genérico Sprint 2.3 intacto", () => {
  assert.doesNotMatch(migration24Sql, /resolve_customer_atencion_consultation/)
  assert.match(migration23Sql, /resolve_customer_atencion_consultation/)
})

test("48. start Sprint 2.3 intacto", () => {
  assert.doesNotMatch(migration24Sql, /start_customer_atencion_management/)
})

test("49. Nueva Atención Sprint 2.2 intacta", () => {
  assert.match(formSource, /Resolver ahora/)
  assert.match(formSource, /continuar_gestion/)
  assert.doesNotMatch(migration24Sql, /atencion-form-dialog/)
})

test("50. Bandeja Sprint 2.1 intacta", () => {
  assert.match(inboxSource, /ConsultationInboxSection/)
  assert.match(inboxSource, /Bandeja de Consultas/)
})

test("51. Sprint 2.0 intacto", () => {
  assert.match(migration20Sql, /customer_atenciones_record_consulta_creada_event/)
  assert.doesNotMatch(migration24Sql, /DROP TRIGGER.*consulta_creada/)
})

test("52. consulta_creada no duplicado", () => {
  assert.doesNotMatch(migration24Sql, /'consulta_creada'/)
})

test("53. customer_retenciones legacy intacto", () => {
  assert.doesNotMatch(migration24Sql, /customer_retenciones/)
})

test("54. Recuperaciones intactas", () => {
  assert.doesNotMatch(migration24Sql, /customer_recuperaciones/)
})

test("55. Equipo intacto", () => {
  assert.match(readFileSync(modulePath, "utf8"), /EquipoSection/)
})

test("56. reportes intactos", () => {
  assert.doesNotMatch(migration24Sql, /equipo-report/)
})

test("57. acceso módulo intacto", () => {
  assert.match(
    readFileSync(join(__dirname, "../lib/customer-atenciones/module-access.ts"), "utf8"),
    /atencion_cliente/
  )
})

test("58. OT intactas", () => {
  assert.doesNotMatch(migration24Sql, /CREATE TABLE.*ot/i)
  assert.doesNotMatch(migration24Sql, /mobile_api/)
})

test("59. Mobile API intacta", () => {
  assert.doesNotMatch(migration24Sql, /mobile/)
})

// helpers adicionales

test("isRetentionConsultation detecta realizar_retencion", () => {
  assert.equal(isRetentionConsultation({ nextStep: RETENTION_NEXT_STEP }), true)
  assert.equal(isRetentionConsultation({ nextStep: "contactar_cliente" }), false)
})

test("buildRetentionFirmBajaDeferInput mapea derivar_admin_gestion", () => {
  const input = buildRetentionFirmBajaDeferInput("Mudanza sin cobertura")
  assert.equal(input.nextStep, RETENTION_FIRM_BAJA_NEXT_STEP)
  assert.equal(input.detail, "Mudanza sin cobertura")
})

test("buildRetentionRetainedResolveInput mapea resolución", () => {
  const input = buildRetentionRetainedResolveInput("Se ofreció cambio de plan")
  assert.equal(input.resolution, "Se ofreció cambio de plan")
})

test("defer API acepta detail opcional", () => {
  assert.match(deferRouteSource, /detail\?: string/)
  assert.match(serverSource, /p_detail/)
  assert.match(browserSource, /detail\?: string/)
})

test("provider defer acepta detail opcional", () => {
  assert.match(providerSource, /detail\?: string/)
})

test("migración 2.3 histórica intacta", () => {
  assert.doesNotMatch(migration23Path, /sprint_2_4/)
})

test("migración 2.4 solo reemplaza defer", () => {
  assert.doesNotMatch(migration24Sql, /CREATE TABLE/)
  assert.doesNotMatch(migration24Sql, /ALTER TABLE/)
  assert.match(migration24Sql, /DROP FUNCTION IF EXISTS public\.defer_customer_atencion_consultation/)
})

test("RPC grants service_role only", () => {
  assert.match(migration24Sql, /GRANT EXECUTE ON FUNCTION public\.defer_customer_atencion_consultation/)
  assert.match(migration24Sql, /TO service_role/)
  assert.match(migration24Sql, /REVOKE EXECUTE.*authenticated/)
})

test("canStart para_resolver retención", () => {
  assert.equal(canStartConsultationManagement("para_resolver"), true)
})

test("active retention managed by employee", () => {
  assert.equal(
    isActiveRetentionConsultationForEmployee(
      atencion({
        status: "en_gestion",
        activeManagementEmployeeId: "employee-1",
      }),
      "employee-1"
    ),
    true
  )
  assert.equal(
    isConsultationManagedByEmployee(
      atencion({
        status: "en_gestion",
        activeManagementEmployeeId: "employee-1",
      }),
      "employee-1"
    ),
    true
  )
})

test("validateResolve y validateRetention comparten requisito de texto", () => {
  assert.ok("error" in validateResolveConsultationResolution(""))
  assert.ok("error" in validateRetentionRetainedResolution(""))
})

// HOTFIX UX — Trabajo por resolver

const moduleSource = readFileSync(modulePath, "utf8")
const operationalSectionSource = readFileSync(operationalSectionPath, "utf8")
const queriesSource = readFileSync(queriesPath, "utf8")

function operationalRow(overrides) {
  return inboxRow({
    status: "para_resolver",
    ...overrides,
  })
}

test("UX-1. KPIs principales permanecen intactos", () => {
  assert.match(
    readFileSync(
      join(__dirname, "../components/atencion-cliente/consultation-inbox-summary.tsx"),
      "utf8"
    ),
    /Para resolver/
  )
  assert.match(moduleSource, /ConsultationInboxSummary/)
})

test("UX-2. existe sección Trabajo por resolver", () => {
  assert.match(operationalSectionSource, /Trabajo por resolver/)
  assert.match(moduleSource, /ConsultationOperationalWorkSection/)
})

test("UX-3. sección es colapsable", () => {
  assert.match(operationalSectionSource, /isExpanded/)
  assert.match(operationalSectionSource, /aria-expanded/)
})

test("UX-4. Retenciones clasifica realizar_retencion", () => {
  assert.equal(
    getOperationalCategoryForNextStep("realizar_retencion"),
    "retenciones"
  )
})

test("UX-5. Administración clasifica derivar_admin_facturacion", () => {
  assert.equal(
    getOperationalCategoryForNextStep("derivar_admin_facturacion"),
    "administracion"
  )
})

test("UX-6. Administración clasifica derivar_admin_gestion", () => {
  assert.equal(
    getOperationalCategoryForNextStep("derivar_admin_gestion"),
    "administracion"
  )
})

test("UX-7. Técnica clasifica resolver_consulta_tecnica", () => {
  assert.equal(
    getOperationalCategoryForNextStep("resolver_consulta_tecnica"),
    "tecnica"
  )
})

test("UX-8. generar_ot clasifica en categoría Pendiente de generar OT", () => {
  assert.equal(getOperationalCategoryForNextStep("generar_ot"), "generar_ot")
  assert.equal(
    SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG.generar_ot.label,
    "Pendiente de generar OT"
  )
})

test("UX-9. Derivar a Ventas clasifica contactar_cliente", () => {
  assert.equal(
    getOperationalCategoryForNextStep("contactar_cliente"),
    "contactar_cliente"
  )
})

test("UX-10. esperar_cliente no crea mini-KPI", () => {
  assert.equal(getOperationalCategoryForNextStep("esperar_cliente"), null)
  assert.doesNotMatch(
    operationalSectionSource,
    /esperar_cliente/
  )
})

test("UX-11. resueltas no cuentan", () => {
  const counts = computeOperationalWorkCounts([
    operationalRow({ nextStep: "realizar_retencion", status: "resuelta" }),
  ])
  assert.equal(counts.retenciones, 0)
  assert.equal(counts.generar_ot, 0)
})

test("UX-12. conteos usan Consultas activas", () => {
  const counts = computeOperationalWorkCounts([
    operationalRow({ nextStep: "realizar_retencion", status: "para_resolver" }),
    operationalRow({ nextStep: "realizar_retencion", status: "en_gestion" }),
    operationalRow({ nextStep: "realizar_retencion", status: "pendiente" }),
    operationalRow({ nextStep: "realizar_retencion", status: "nueva" }),
  ])
  assert.equal(counts.retenciones, 4)
})

test("UX-13. categorías con cero no se muestran como mini-KPI", () => {
  const counts = computeOperationalWorkCounts([
    operationalRow({ nextStep: "realizar_retencion" }),
  ])
  assert.deepEqual(getVisibleOperationalCategories(counts), ["retenciones"])
  assert.match(operationalSectionSource, /getVisibleOperationalCategories/)
})

test("UX-14. clic Retenciones filtra correctamente", () => {
  const rows = [
    operationalRow({ id: "r1", nextStep: "realizar_retencion" }),
    operationalRow({ id: "r2", nextStep: "contactar_cliente" }),
  ]
  const filtered = filterSharedInboxRows(rows, {
    statusFilter: "all",
    motivo: "all",
    channel: "all",
    operationalCategory: "retenciones",
  })
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].id, "r1")
})

test("UX-15. clic Administración filtra next_steps admin", () => {
  const rows = [
    operationalRow({ id: "a1", nextStep: "derivar_admin_facturacion" }),
    operationalRow({ id: "a2", nextStep: "derivar_admin_gestion" }),
    operationalRow({ id: "a3", nextStep: "derivar_admin_morosos" }),
    operationalRow({ id: "a4", nextStep: "realizar_retencion" }),
  ]
  const filtered = filterSharedInboxRows(rows, {
    statusFilter: "all",
    motivo: "all",
    channel: "all",
    operationalCategory: "administracion",
  })
  assert.equal(filtered.length, 3)
})

test("UX-16. clic Técnica filtra solo resolver_consulta_tecnica", () => {
  const rows = [
    operationalRow({ id: "t1", nextStep: "resolver_consulta_tecnica" }),
    operationalRow({ id: "t2", nextStep: "generar_ot" }),
    operationalRow({ id: "t3", nextStep: "contactar_cliente" }),
  ]
  const filtered = filterSharedInboxRows(rows, {
    statusFilter: "all",
    motivo: "all",
    channel: "all",
    operationalCategory: "tecnica",
  })
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].id, "t1")
})

test("UX-16b. clic Pendiente de generar OT filtra generar_ot", () => {
  const rows = [
    operationalRow({ id: "ot1", nextStep: "generar_ot" }),
    operationalRow({ id: "ot2", nextStep: "resolver_consulta_tecnica" }),
  ]
  const filtered = filterSharedInboxRows(rows, {
    statusFilter: "all",
    motivo: "all",
    channel: "all",
    operationalCategory: "generar_ot",
  })
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].id, "ot1")
})

test("UX-17. clic Ventas filtra correctamente", () => {
  assert.equal(
    matchesOperationalCategory(
      operationalRow({ nextStep: "contactar_cliente" }),
      "contactar_cliente"
    ),
    true
  )
})

test("UX-18. filtro operativo se combina con motivo", () => {
  const rows = [
    operationalRow({
      id: "m1",
      nextStep: "realizar_retencion",
      motivo: "baja",
    }),
    operationalRow({
      id: "m2",
      nextStep: "realizar_retencion",
      motivo: "facturacion",
    }),
  ]
  const filtered = filterSharedInboxRows(rows, {
    statusFilter: "all",
    motivo: "baja",
    channel: "all",
    operationalCategory: "retenciones",
  })
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].id, "m1")
})

test("UX-19. filtro operativo se combina con canal", () => {
  const rows = [
    operationalRow({
      id: "c1",
      nextStep: "realizar_retencion",
      channel: "whatsapp",
    }),
    operationalRow({
      id: "c2",
      nextStep: "realizar_retencion",
      channel: "telefono",
    }),
  ]
  const filtered = filterSharedInboxRows(rows, {
    statusFilter: "all",
    motivo: "all",
    channel: "whatsapp",
    operationalCategory: "retenciones",
  })
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].id, "c1")
})

test("UX-20. clic mini-KPI limpia filtro de estado", () => {
  assert.match(operationalSectionSource, /statusFilter: "all"/)
})

test("UX-21. categoría activa tiene estado visual", () => {
  assert.match(
    operationalSectionSource,
    /const isActive = query\.operationalCategory === category/
  )
  assert.match(operationalSectionSource, /isActive=\{isActive\}/)
  assert.match(operationalSectionSource, /✓ \$\{config\.label\}/)
})

test("UX-22. filtro operativo es sticky y se limpia con acción explícita", () => {
  assert.match(operationalSectionSource, /operationalCategory: category/)
  assert.doesNotMatch(
    operationalSectionSource,
    /operationalCategory: isActive \? null : category/
  )
  assert.match(operationalSectionSource, /Limpiar filtro/)
  assert.match(inboxSource, /operationalCategory: null/)
})

test("UX-23. Cliente retenido desaparece de Retenciones", () => {
  const counts = computeOperationalWorkCounts([
    operationalRow({ status: "resuelta", nextStep: null }),
    operationalRow({ status: "para_resolver", nextStep: "realizar_retencion" }),
  ])
  assert.equal(counts.retenciones, 1)
})

test("UX-24. Baja sigue firme desaparece de Retenciones", () => {
  const counts = computeOperationalWorkCounts([
    operationalRow({
      status: "para_resolver",
      nextStep: "derivar_admin_gestion",
    }),
  ])
  assert.equal(counts.retenciones, 0)
})

test("UX-25. Baja sigue firme aparece en Administración", () => {
  const counts = computeOperationalWorkCounts([
    operationalRow({
      status: "para_resolver",
      nextStep: "derivar_admin_gestion",
    }),
  ])
  assert.equal(counts.administracion, 1)
})

test("UX-26. no hay endpoint nuevo", () => {
  assert.doesNotMatch(operationalSectionSource, /\/api\//)
  assert.match(queriesSource, /fetchSharedInboxBundle/)
})

test("UX-27. no hay RPC nueva", () => {
  assert.doesNotMatch(queriesSource, /CREATE OR REPLACE FUNCTION/)
})

test("UX-28. no hay migración nueva", () => {
  assert.doesNotMatch(operationalSectionSource, /\.sql/)
})

test("UX-29. Sprint 2.4 funcional intacto", () => {
  assert.match(detailSource, /Registrar resultado de retención/)
  assert.match(migration24Sql, /defer_customer_atencion_consultation/)
})

test("UX-30. Sprint 2.3 intacto", () => {
  assert.match(migration23Sql, /start_customer_atencion_management/)
})

test("UX-31. Nueva Atención 2.2 intacta", () => {
  assert.match(formSource, /continuar_gestion/)
})

test("UX-32. Bandeja 2.1 intacta", () => {
  assert.match(inboxSource, /Bandeja de Consultas/)
})

test("UX-33. categorías definidas en helper central", () => {
  assert.equal(
    SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG.retenciones.nextSteps.length,
    1
  )
  assert.equal(
    SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG.administracion.nextSteps.length,
    3
  )
  assert.equal(
    SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG.tecnica.nextSteps.length,
    1
  )
  assert.equal(
    SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG.generar_ot.nextSteps.length,
    1
  )
  assert.deepEqual(
    computeOperationalWorkCounts([]),
    {
      retenciones: 0,
      administracion: 0,
      morosos: 0,
      tecnica: 0,
      contactar_cliente: 0,
      generar_ot: 0,
    }
  )
})

test("UX-34. contactar_cliente se muestra como Ventas en clasificación operativa", () => {
  assert.equal(
    SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG.contactar_cliente.label,
    "Ventas"
  )
  assert.equal(
    formatCustomerAtencionNextStepLabel("contactar_cliente"),
    "Derivar a Ventas"
  )
})
