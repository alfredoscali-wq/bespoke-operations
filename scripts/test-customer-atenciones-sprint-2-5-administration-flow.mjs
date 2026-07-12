import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  buildAdministrationDeferInput,
  buildAdministrationResolvedInput,
  isActiveAdministrationConsultationForEmployee,
  isAdministrationConsultation,
  mapAdministrationOutcomeToAction,
  validateAdministrationDeferDetail,
  validateAdministrationResolvedResolution,
} from "../lib/customer-atenciones/administration-flow.ts"
import { canAccessAtencionClienteModule } from "../lib/customer-atenciones/module-access.ts"
import { isActiveRetentionConsultationForEmployee } from "../lib/customer-atenciones/retention-flow.ts"
import { DEFAULT_COMPANY_AREA_MODULE_VISIBILITY } from "../lib/roles/company-areas.ts"
import { hasWebModuleAccess } from "../lib/roles/web-module-access.ts"
import { filterSharedInboxRows } from "../lib/customer-atenciones/shared-inbox.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))

const detailPath = join(
  __dirname,
  "../components/atencion-cliente/atencion-detail-screen.tsx"
)
const administrationDialogPath = join(
  __dirname,
  "../components/atencion-cliente/administration-result-dialog.tsx"
)
const moduleAccessPath = join(
  __dirname,
  "../lib/customer-atenciones/module-access.ts"
)
const routeHelperPath = join(
  __dirname,
  "../lib/customer-atenciones/consultation-management-route.ts"
)
const sprint10MigrationPath = join(
  __dirname,
  "../supabase/migrations/20260925000100_customer_atenciones_sprint_1_0.sql"
)
const providerPath = join(
  __dirname,
  "../components/atencion-cliente/atencion-cliente-provider.tsx"
)

const detailSource = readFileSync(detailPath, "utf8")
const administrationDialogSource = readFileSync(administrationDialogPath, "utf8")
const moduleAccessSource = readFileSync(moduleAccessPath, "utf8")
const routeHelperSource = readFileSync(routeHelperPath, "utf8")
const sprint10Sql = readFileSync(sprint10MigrationPath, "utf8")
const providerSource = readFileSync(providerPath, "utf8")

function buildSessionUser(overrides) {
  return {
    authUserId: "auth-1",
    employeeId: "emp-1",
    companyId: "company-1",
    displayName: "Test User",
    initials: "TU",
    systemRole: "administrativo",
    roleId: "role-1",
    roleCode: "administracion",
    roleName: "Administración",
    moduleVisibility: DEFAULT_COMPANY_AREA_MODULE_VISIBILITY.administracion,
    visibleModuleKeys: [],
    nationalId: null,
    mustChangePassword: false,
    email: "test@example.com",
    ...overrides,
  }
}

function atencion(overrides) {
  return {
    status: "en_gestion",
    nextStep: "resolver_facturacion",
    activeManagementEmployeeId: "employee-1",
    ...overrides,
  }
}

function inboxRow(overrides) {
  return {
    id: "row-1",
    customerId: "customer-1",
    customerName: "Juan Pérez",
    channel: "whatsapp",
    motivo: "facturacion",
    detail: "Consulta",
    status: "para_resolver",
    nextStep: "resolver_facturacion",
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

// Acceso compartido

test("1. administracion default visibility incluye atencion_cliente", () => {
  assert.equal(
    DEFAULT_COMPANY_AREA_MODULE_VISIBILITY.administracion.atencion_cliente,
    true
  )
  assert.equal(
    DEFAULT_COMPANY_AREA_MODULE_VISIBILITY.atencion_cliente.atencion_cliente,
    true
  )
})

test("2. administracion con visibility default puede acceder al módulo", () => {
  const sessionUser = buildSessionUser({})
  assert.equal(hasWebModuleAccess(sessionUser, "atencion_cliente"), true)
  assert.equal(canAccessAtencionClienteModule(sessionUser), true)
})

test("3. acceso depende de module_visibility, no de area hardcodeada", () => {
  assert.match(moduleAccessSource, /hasWebModuleAccess\(sessionUser, "atencion_cliente"\)/)
  assert.doesNotMatch(moduleAccessSource, /employee\.area/)
  assert.doesNotMatch(moduleAccessSource, /roleCode === "atencion_cliente"/)
})

test("4. APIs usan canAccessAtencionClienteModule sin restricción por área", () => {
  assert.match(routeHelperSource, /canAccessAtencionClienteModule/)
  assert.match(routeHelperSource, /resolveAtencionClienteActorEmployeeId/)
  assert.doesNotMatch(routeHelperSource, /administracion/)
})

test("5. RLS usa módulo atencion_cliente, no área del empleado", () => {
  assert.match(sprint10Sql, /auth_user_has_allowed_module\('atencion_cliente'\)/)
  assert.match(sprint10Sql, /'administracion', 'atencion_cliente'/)
})

test("6. actor seguro registra employee_id, no área", () => {
  assert.match(routeHelperSource, /resolveAtencionClienteActorEmployeeId/)
  assert.match(routeHelperSource, /employeeId/)
  assert.doesNotMatch(moduleAccessSource, /employee\.area/)
})

// Especialización Administración

test("7. resolver_facturacion clasifica como Administración", () => {
  assert.equal(
    isAdministrationConsultation({ nextStep: "resolver_facturacion" }),
    true
  )
})

test("8. esperar_administracion clasifica como Administración", () => {
  assert.equal(
    isAdministrationConsultation({ nextStep: "esperar_administracion" }),
    true
  )
})

test("9. retención no clasifica como Administración", () => {
  assert.equal(
    isAdministrationConsultation({ nextStep: "realizar_retencion" }),
    false
  )
})

test("10. gestión activa del actor muestra UI Administración", () => {
  assert.match(detailSource, /Registrar resultado administrativo/)
  assert.match(detailSource, /isActiveAdministrationConsultationForEmployee/)
})

test("11. UI genérica se oculta durante Administración activa", () => {
  assert.match(detailSource, /isActiveAdministration \?/)
  assert.match(detailSource, /: isManagedByCurrentEmployee \?/)
})

test("12. formulario ofrece Facturación resuelta", () => {
  assert.match(administrationDialogSource, /Facturación resuelta/)
})

test("13. formulario ofrece Cliente con deuda", () => {
  assert.match(administrationDialogSource, /Cliente con deuda/)
})

test("14. formulario ofrece Esperando documentación", () => {
  assert.match(administrationDialogSource, /Esperando documentación/)
})

test("15. formulario ofrece Confirmar baja", () => {
  assert.match(administrationDialogSource, /Confirmar baja/)
})

test("16. Facturación resuelta requiere resolución", () => {
  assert.ok("error" in validateAdministrationResolvedResolution(""))
})

test("17. defer administrativo requiere detalle", () => {
  assert.ok("error" in validateAdministrationDeferDetail(""))
})

test("18. Facturación resuelta usa resolve", () => {
  assert.deepEqual(mapAdministrationOutcomeToAction("facturacion_resuelta"), {
    kind: "resolve",
  })
})

test("19. Cliente con deuda → esperar_cliente", () => {
  assert.deepEqual(mapAdministrationOutcomeToAction("cliente_con_deuda"), {
    kind: "defer",
    nextStep: "esperar_cliente",
  })
})

test("20. Esperando documentación → esperar_cliente", () => {
  assert.deepEqual(mapAdministrationOutcomeToAction("esperando_documentacion"), {
    kind: "defer",
    nextStep: "esperar_cliente",
  })
})

test("21. Confirmar baja → generar_ot", () => {
  assert.deepEqual(mapAdministrationOutcomeToAction("confirmar_baja"), {
    kind: "defer",
    nextStep: "generar_ot",
  })
})

test("22. Confirmar baja prepara generar_ot sin crear OT", () => {
  const input = buildAdministrationDeferInput("generar_ot", "Baja confirmada")
  assert.equal(input.nextStep, "generar_ot")
  assert.equal(input.detail, "Baja confirmada")
  assert.doesNotMatch(administrationDialogSource, /createWorkOrder|insertWorkOrder|from\("@\/lib\/tasks/i)
})

test("23. Facturación resuelta persiste resolución real", () => {
  const input = buildAdministrationResolvedInput("Cupón corregido")
  assert.equal(input.resolution, "Cupón corregido")
})

test("24. defer administrativo persiste detalle real", () => {
  const input = buildAdministrationDeferInput(
    "esperar_cliente",
    "Cliente con deuda informada"
  )
  assert.equal(input.detail, "Cliente con deuda informada")
})

test("25. otro empleado no puede registrar resultado administrativo", () => {
  assert.equal(
    isActiveAdministrationConsultationForEmployee(
      atencion({ activeManagementEmployeeId: "employee-2" }),
      "employee-1"
    ),
    false
  )
})

test("26. actor activo puede registrar resultado administrativo", () => {
  assert.equal(
    isActiveAdministrationConsultationForEmployee(
      atencion({ activeManagementEmployeeId: "employee-1" }),
      "employee-1"
    ),
    true
  )
})

// Compatibilidad

test("27. retención activa sigue priorizando UI Retención", () => {
  assert.match(detailSource, /isActiveRetention \?/)
  assert.equal(
    isActiveRetentionConsultationForEmployee(
      {
        status: "en_gestion",
        nextStep: "realizar_retencion",
        activeManagementEmployeeId: "employee-1",
      },
      "employee-1"
    ),
    true
  )
})

test("28. provider compartido sin bifurcación por área", () => {
  assert.doesNotMatch(providerSource, /roleCode === "atencion_cliente"/)
  assert.match(providerSource, /loadSharedInboxBundle/)
})

test("29. confirmar baja filtra en bandeja como generar_ot pendiente", () => {
  const row = inboxRow({
    status: "pendiente",
    nextStep: "generar_ot",
  })
  const filtered = filterSharedInboxRows([row], {
    statusFilter: "pendiente",
    motivo: "all",
    channel: "all",
    operationalCategory: "tecnica",
  })
  assert.equal(filtered.length, 1)
})

test("30. sin migración nueva en Sprint 2.5", () => {
  assert.doesNotMatch(detailSource, /20261008/)
  assert.doesNotMatch(administrationDialogSource, /\.sql/)
})

test("31. sin endpoint nuevo", () => {
  assert.doesNotMatch(administrationDialogSource, /\/api\//)
})

test("32. sin RPC nueva", () => {
  assert.doesNotMatch(administrationDialogSource, /CREATE OR REPLACE FUNCTION/)
})
