import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  canStartConsultationManagement,
  CONSULTATION_DEFER_DEFAULT_RESOLUTION,
  CONSULTATION_MANAGEMENT_START_STATUSES,
  isConsultationManagedByAnotherEmployee,
  isConsultationManagedByEmployee,
  mapConsultationManagementRpcError,
  parseConsultationManagementRpcResult,
  resolveDeferConsultationStatus,
  validateDeferConsultationNextStep,
  validateResolveConsultationResolution,
} from "../lib/customer-atenciones/consultation-management.ts"
import { resolveInitialConsultationStatusFromNextStep } from "../lib/customer-atenciones/consultation.ts"
import {
  filterSharedInboxRows,
  isActiveConsultationStatus,
} from "../lib/customer-atenciones/shared-inbox.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationPath = join(
  __dirname,
  "../supabase/migrations/20261006000100_customer_atenciones_sprint_2_3_shared_management.sql"
)
const sprint20MigrationPath = join(
  __dirname,
  "../supabase/migrations/20261005000100_customer_atenciones_sprint_2_0.sql"
)
const providerPath = join(
  __dirname,
  "../components/atencion-cliente/atencion-cliente-provider.tsx"
)
const detailPath = join(
  __dirname,
  "../components/atencion-cliente/atencion-detail-screen.tsx"
)
const formPath = join(
  __dirname,
  "../components/atencion-cliente/atencion-form-dialog.tsx"
)
const modulePath = join(
  __dirname,
  "../components/atencion-cliente/atencion-cliente-module.tsx"
)
const startRoutePath = join(
  __dirname,
  "../app/api/atencion-cliente/[atencionId]/start-management/route.ts"
)
const resolveRoutePath = join(
  __dirname,
  "../app/api/atencion-cliente/[atencionId]/resolve/route.ts"
)
const deferRoutePath = join(
  __dirname,
  "../app/api/atencion-cliente/[atencionId]/defer/route.ts"
)
const serverPath = join(
  __dirname,
  "../lib/customer-atenciones/consultation-management.server.ts"
)

const migrationSql = readFileSync(migrationPath, "utf8")

function sliceRpcBlock(sql, functionName, nextFunctionName) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${functionName}`)
  const end = nextFunctionName
    ? sql.indexOf(`CREATE OR REPLACE FUNCTION public.${nextFunctionName}`, start + 1)
    : sql.length
  return sql.slice(start, end > start ? end : sql.length)
}

const startRpcSql = sliceRpcBlock(
  migrationSql,
  "start_customer_atencion_management",
  "resolve_customer_atencion_consultation"
)
const resolveRpcSql = sliceRpcBlock(
  migrationSql,
  "resolve_customer_atencion_consultation",
  "defer_customer_atencion_consultation"
)
const deferRpcSql = sliceRpcBlock(
  migrationSql,
  "defer_customer_atencion_consultation",
  null
)
const routeHelperPath = join(
  __dirname,
  "../lib/customer-atenciones/consultation-management-route.ts"
)
const sprint20Sql = readFileSync(sprint20MigrationPath, "utf8")
const providerSource = readFileSync(providerPath, "utf8")
const detailSource = readFileSync(detailPath, "utf8")

function inboxRow(overrides) {
  return {
    id: "row-1",
    customerId: "customer-1",
    customerName: "Juan Pérez",
    channel: "whatsapp",
    motivo: "facturacion",
    detail: "Detalle",
    status: "para_resolver",
    nextStep: "contactar_cliente",
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

test("1. para_resolver puede iniciar", () => {
  assert.equal(canStartConsultationManagement("para_resolver"), true)
})

test("2. pendiente puede iniciar", () => {
  assert.equal(canStartConsultationManagement("pendiente"), true)
})

test("3. nueva no puede iniciar", () => {
  assert.equal(canStartConsultationManagement("nueva"), false)
})

test("4. en_gestion no puede iniciar por otro empleado", () => {
  assert.equal(canStartConsultationManagement("en_gestion"), false)
  assert.equal(
    isConsultationManagedByAnotherEmployee(
      {
        status: "en_gestion",
        activeManagementEmployeeId: "employee-2",
      },
      "employee-1"
    ),
    true
  )
})

test("5. resuelta no puede iniciar", () => {
  assert.equal(canStartConsultationManagement("resuelta"), false)
})

test("6. start setea status en_gestion", () => {
  assert.match(migrationSql, /status = 'en_gestion'/)
})

test("7. start conserva next_step", () => {
  assert.match(startRpcSql, /'new_next_step', v_atencion\.next_step/)
  assert.doesNotMatch(startRpcSql, /next_step =/)
})

test("8. start setea active employee", () => {
  assert.match(migrationSql, /active_management_employee_id = p_employee_id/)
})

test("9. start setea timestamp DB", () => {
  assert.match(migrationSql, /active_management_started_at = now\(\)/)
})

test("10. start crea gestion_iniciada", () => {
  assert.match(migrationSql, /'gestion_iniciada'/)
})

test("11. start mutación + evento atómicos", () => {
  assert.match(startRpcSql, /FOR UPDATE/)
  assert.match(startRpcSql, /INSERT INTO public\.customer_atencion_events/)
})

test("12. actor resuelto de forma segura", () => {
  assert.match(readFileSync(startRoutePath, "utf8"), /requireAtencionClienteMutationContext/)
  assert.match(readFileSync(startRoutePath, "utf8"), /employeeId: auth\.employeeId/)
  assert.match(readFileSync(serverPath, "utf8"), /p_employee_id: input\.employeeId/)
})

test("13. tenant validado", () => {
  assert.match(migrationSql, /e\.company_id = p_company_id/)
  assert.match(migrationSql, /ca\.company_id = p_company_id/)
})

test("14. demo read-only bloqueado", () => {
  assert.match(migrationSql, /auth_is_demo_platform_read_only\(\)/)
  assert.match(readFileSync(routeHelperPath, "utf8"), /requireWritablePlatformSession/)
})

test("15. concurrencia impide doble toma", () => {
  assert.match(migrationSql, /CONSULTATION_ALREADY_IN_MANAGEMENT/)
  assert.match(migrationSql, /FOR UPDATE/)
  const mapped = mapConsultationManagementRpcError(
    "CONSULTATION_ALREADY_IN_MANAGEMENT"
  )
  assert.equal(mapped.code, "CONSULTATION_ALREADY_IN_MANAGEMENT")
  assert.match(mapped.message, /otra persona/)
})

test("16. mismo empleado no duplica evento", () => {
  assert.match(migrationSql, /idempotent', true/)
  assert.match(migrationSql, /active_management_employee_id = p_employee_id THEN/)
})

test("17. solo active employee puede resolver", () => {
  assert.match(migrationSql, /active_management_employee_id IS DISTINCT FROM p_employee_id/)
  assert.equal(
    isConsultationManagedByEmployee(
      { status: "en_gestion", activeManagementEmployeeId: "employee-1" },
      "employee-1"
    ),
    true
  )
})

test("18. otro empleado no puede resolver", () => {
  assert.equal(
    isConsultationManagedByEmployee(
      { status: "en_gestion", activeManagementEmployeeId: "employee-2" },
      "employee-1"
    ),
    false
  )
})

test("19. resolución requerida", () => {
  const result = validateResolveConsultationResolution("   ")
  assert.ok("error" in result)
  assert.match(migrationSql, /CONSULTATION_RESOLUTION_REQUIRED/)
})

test("20. resolve setea resuelta", () => {
  assert.match(migrationSql, /status = 'resuelta'/)
})

test("21. resolve limpia next_step", () => {
  assert.match(migrationSql, /next_step = NULL/)
})

test("22. resolve limpia active employee", () => {
  assert.match(resolveRpcSql, /active_management_employee_id = NULL/)
})

test("23. resolve limpia active timestamp", () => {
  assert.match(resolveRpcSql, /active_management_started_at = NULL/)
})

test("24. resolve setea resultado resuelta", () => {
  assert.match(migrationSql, /resultado = 'resuelta'/)
})

test("25. resolve persiste resolution real", () => {
  assert.match(migrationSql, /resolution = v_resolution/)
  assert.match(migrationSql, /detail,\s*previous_status/)
})

test("26. resolve crea consulta_resuelta", () => {
  assert.match(migrationSql, /'consulta_resuelta'/)
})

test("27. resolve mutación + evento atómicos", () => {
  assert.match(resolveRpcSql, /FOR UPDATE/)
  assert.match(resolveRpcSql, /INSERT INTO public\.customer_atencion_events/)
})

test("28. solo active employee puede continuar", () => {
  assert.match(deferRpcSql, /CONSULTATION_MANAGEMENT_ACTOR_MISMATCH/)
})

test("29. próximo paso requerido", () => {
  const result = validateDeferConsultationNextStep(undefined)
  assert.ok("error" in result)
  assert.match(migrationSql, /CONSULTATION_NEXT_STEP_REQUIRED/)
})

for (const nextStep of [
  "realizar_retencion",
  "resolver_facturacion",
  "analizar_problema_tecnico",
  "contactar_cliente",
  "coordinar_retiro",
  "generar_ot",
]) {
  test(`30. acción interna ${nextStep} → para_resolver`, () => {
    assert.equal(resolveDeferConsultationStatus(nextStep), "para_resolver")
    assert.equal(resolveInitialConsultationStatusFromNextStep(nextStep), "para_resolver")
  })
}

for (const nextStep of ["esperar_cliente", "esperar_administracion"]) {
  test(`31. espera ${nextStep} → pendiente`, () => {
    assert.equal(resolveDeferConsultationStatus(nextStep), "pendiente")
  })
}

test("32. conserva/persiste nuevo next_step", () => {
  assert.match(migrationSql, /next_step = v_next_step/)
})

test("33. limpia active employee al continuar", () => {
  assert.match(deferRpcSql, /active_management_employee_id = NULL/)
})

test("34. limpia active timestamp al continuar", () => {
  assert.match(deferRpcSql, /active_management_started_at = NULL/)
})

test("35. setea resultado requiere_seguimiento", () => {
  assert.match(migrationSql, /resultado = 'requiere_seguimiento'/)
})

test("36. crea consulta_pendiente", () => {
  assert.match(migrationSql, /'consulta_pendiente'/)
})

test("37. evento conserva previous/new status", () => {
  assert.match(deferRpcSql, /previous_status,\s*new_status/)
})

test("38. evento conserva previous/new next_step", () => {
  assert.match(deferRpcSql, /previous_next_step,\s*new_next_step/)
})

test("39. defer mutación + evento atómicos", () => {
  assert.match(deferRpcSql, /FOR UPDATE/)
  assert.match(deferRpcSql, /INSERT INTO public\.customer_atencion_events/)
})

test("40. detalle muestra Iniciar gestión cuando corresponde", () => {
  assert.match(detailSource, /Iniciar gestión/)
  assert.match(detailSource, /canStartConsultationManagement/)
})

test("41. detalle muestra Resolver/Continuar al active employee", () => {
  assert.match(detailSource, /Resolver Consulta/)
  assert.match(detailSource, /Continuar después/)
  assert.match(detailSource, /isConsultationManagedByEmployee/)
})

test("42. detalle bloquea acciones a otro empleado", () => {
  assert.match(detailSource, /isConsultationManagedByAnotherEmployee/)
  assert.match(detailSource, /En gestión por/)
})

test("43. detalle muestra empleado activo y hora", () => {
  assert.match(detailSource, /activeManagementStartedAt/)
  assert.match(detailSource, /formatEmployeeName\(activeEmployee\)/)
})

test("44. error concurrencia tiene mensaje legible", () => {
  const mapped = mapConsultationManagementRpcError(
    "Esta Consulta ya está siendo gestionada por otra persona."
  )
  assert.match(mapped.message, /otra persona/)
})

test("45. acción exitosa refresca detalle", () => {
  assert.match(detailSource, /refreshAtencionById/)
  assert.match(detailSource, /await loadDetail\(\)/)
})

test("46. acción exitosa refresca Bandeja", () => {
  assert.match(providerSource, /refreshSharedInbox\(\)/)
})

test("47. acción exitosa refresca KPIs", () => {
  assert.match(providerSource, /refreshSharedInbox/)
  assert.match(providerSource, /getSharedInboxKpiSummary/)
})

test("48. Bandeja refleja en_gestion", () => {
  const managed = inboxRow({
    status: "en_gestion",
    activeManagementEmployeeId: "employee-2",
    activeManagementEmployeeName: "María",
  })
  assert.equal(isActiveConsultationStatus("en_gestion"), true)
  const filtered = filterSharedInboxRows([managed], {
    statusFilter: "en_gestion",
    motivo: "all",
    channel: "all",
  })
  assert.equal(filtered.length, 1)
})

test("49. resolución mueve a Resueltas", () => {
  const resolved = inboxRow({ status: "resuelta", nextStep: null })
  const filtered = filterSharedInboxRows([resolved], {
    statusFilter: "resuelta",
    motivo: "all",
    channel: "all",
  })
  assert.equal(filtered.length, 1)
})

test("50. continuar mueve a Para resolver/Pendientes", () => {
  const action = inboxRow({
    status: "para_resolver",
    nextStep: "contactar_cliente",
  })
  const waiting = inboxRow({
    status: "pendiente",
    nextStep: "esperar_cliente",
  })
  assert.equal(
    filterSharedInboxRows([action], {
      statusFilter: "para_resolver",
      motivo: "all",
      channel: "all",
    }).length,
    1
  )
  assert.equal(
    filterSharedInboxRows([waiting], {
      statusFilter: "pendiente",
      motivo: "all",
      channel: "all",
    }).length,
    1
  )
})

test("51. Nueva Atención 2.2 intacta", () => {
  assert.match(readFileSync(formPath, "utf8"), /Resolver ahora/)
  assert.match(readFileSync(formPath, "utf8"), /continuar_gestion/)
})

test("52. Bandeja 2.1 intacta", () => {
  assert.match(
    readFileSync(
      join(__dirname, "../components/atencion-cliente/consultation-inbox-section.tsx"),
      "utf8"
    ),
    /ConsultationInboxSection/
  )
})

test("53. Sprint 2.0 intacto", () => {
  assert.match(sprint20Sql, /customer_atenciones_record_consulta_creada_event/)
  assert.doesNotMatch(migrationSql, /DROP TRIGGER.*consulta_creada/)
})

test("54. consulta_creada no duplicado", () => {
  assert.doesNotMatch(migrationSql, /'consulta_creada'/)
  assert.doesNotMatch(migrationSql, /gestion_registrada/)
})

test("55. Retenciones intactas", () => {
  assert.doesNotMatch(migrationSql, /customer_retenciones/)
})

test("56. Recuperaciones intactas", () => {
  assert.doesNotMatch(migrationSql, /customer_recuperaciones/)
})

test("57. Equipo intacto", () => {
  assert.match(readFileSync(modulePath, "utf8"), /EquipoSection/)
})

test("58. acceso módulo intacto", () => {
  assert.match(
    readFileSync(join(__dirname, "../lib/customer-atenciones/module-access.ts"), "utf8"),
    /atencion_cliente/
  )
})

test("RPC grants service_role only", () => {
  assert.match(migrationSql, /GRANT EXECUTE ON FUNCTION public\.start_customer_atencion_management/)
  assert.match(migrationSql, /TO service_role/)
  assert.match(migrationSql, /REVOKE EXECUTE.*authenticated/)
})

test("parseConsultationManagementRpcResult", () => {
  const parsed = parseConsultationManagementRpcResult({
    atencion_id: "a-1",
    previous_status: "para_resolver",
    new_status: "en_gestion",
    previous_next_step: "contactar_cliente",
    new_next_step: "contactar_cliente",
    idempotent: false,
  })
  assert.equal(parsed?.atencionId, "a-1")
  assert.equal(parsed?.newStatus, "en_gestion")
})

test("defer resolution placeholder", () => {
  assert.match(migrationSql, new RegExp(CONSULTATION_DEFER_DEFAULT_RESOLUTION))
})

test("start statuses centralizados", () => {
  assert.deepEqual(CONSULTATION_MANAGEMENT_START_STATUSES, [
    "para_resolver",
    "pendiente",
  ])
})

test("API routes usan server RPC", () => {
  assert.match(readFileSync(resolveRoutePath, "utf8"), /resolveCustomerAtencionConsultation/)
  assert.match(readFileSync(deferRoutePath, "utf8"), /deferCustomerAtencionConsultation/)
})

test("provider expone gestión compartida", () => {
  assert.match(providerSource, /startConsultationManagementHandler/)
  assert.match(providerSource, /resolveConsultationHandler/)
  assert.match(providerSource, /deferConsultationHandler/)
})
