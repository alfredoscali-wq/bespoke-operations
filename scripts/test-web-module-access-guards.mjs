import assert from "node:assert/strict"
import test from "node:test"

import { getDefaultPostLoginPath } from "../lib/auth/routes.ts"
import {
  createEmptyModuleVisibility,
  createFullModuleVisibility,
} from "../lib/roles/app-modules.ts"
import { canPermanentlyDeleteWorkOrder } from "../lib/tasks/work-order-deletion-policy.ts"
import {
  canAccessPlanificacionFromAuthMetadata,
  canAccessPlanningWebModule,
  canAccessSettingsConfigWebModule,
  canManageCompanyAreasWeb,
  canUsePlanningWebOperationalActions,
  canUseWorkOrdersWebOperationalActions,
  hasWebModuleAccess,
  isAdministradorSessionUser,
} from "../lib/roles/web-module-access.ts"

function buildSessionUser(overrides) {
  const moduleVisibility = overrides.moduleVisibility ?? createEmptyModuleVisibility()

  return {
    authUserId: "auth-1",
    employeeId: "emp-1",
    companyId: "company-1",
    displayName: "Test User",
    initials: "TU",
    systemRole: overrides.systemRole,
    roleId: overrides.roleId ?? "role-1",
    roleCode: overrides.roleCode ?? "administracion",
    roleName: overrides.roleName ?? "Administración",
    moduleVisibility,
    visibleModuleKeys: [],
    nationalId: null,
    mustChangePassword: false,
    email: "test@example.com",
    ...overrides,
  }
}

test("administrativo con módulo planificacion puede usar acciones operativas web", () => {
  const sessionUser = buildSessionUser({
    systemRole: "administrativo",
    roleCode: "administracion",
    moduleVisibility: {
      ...createEmptyModuleVisibility(),
      planificacion: true,
    },
  })

  assert.equal(canAccessPlanningWebModule(sessionUser), true)
  assert.equal(canUsePlanningWebOperationalActions(sessionUser), true)
})

test("administrativo sin módulo planificacion sigue bloqueado", () => {
  const sessionUser = buildSessionUser({
    systemRole: "administrativo",
    roleCode: "administracion",
    moduleVisibility: createEmptyModuleVisibility(),
  })

  assert.equal(canAccessPlanningWebModule(sessionUser), false)
  assert.equal(canUsePlanningWebOperationalActions(sessionUser), false)
})

test("administrador mantiene acceso total a módulos web", () => {
  const sessionUser = buildSessionUser({
    systemRole: "administrador",
    roleCode: "administrador",
    moduleVisibility: createEmptyModuleVisibility(),
  })

  assert.equal(isAdministradorSessionUser(sessionUser), true)
  assert.equal(hasWebModuleAccess(sessionUser, "planificacion"), true)
  assert.equal(hasWebModuleAccess(sessionUser, "settings"), true)
  assert.equal(canUseWorkOrdersWebOperationalActions(sessionUser), true)
})

test("operario sigue fuera del dashboard administrativo", () => {
  assert.equal(getDefaultPostLoginPath("operario"), "/operario")
  assert.equal(canAccessPlanningWebModule(buildSessionUser({ systemRole: "operario" })), false)
})

test("gestión de Áreas sigue siendo exclusiva del Administrador", () => {
  const admin = buildSessionUser({
    systemRole: "administrador",
    roleCode: "administrador",
    moduleVisibility: createFullModuleVisibility(),
  })
  const administrativo = buildSessionUser({
    systemRole: "administrativo",
    roleCode: "administracion",
    moduleVisibility: {
      ...createFullModuleVisibility(),
      settings: true,
    },
  })

  assert.equal(canManageCompanyAreasWeb(admin), true)
  assert.equal(canManageCompanyAreasWeb(administrativo), false)
})

test("configuración respeta module_visibility salvo Áreas", () => {
  const withSettings = buildSessionUser({
    systemRole: "administrativo",
    roleCode: "ventas",
    moduleVisibility: {
      ...createEmptyModuleVisibility(),
      settings: true,
    },
  })
  const withoutSettings = buildSessionUser({
    systemRole: "administrativo",
    roleCode: "ventas",
    moduleVisibility: createEmptyModuleVisibility(),
  })

  assert.equal(canAccessSettingsConfigWebModule(withSettings), true)
  assert.equal(canAccessSettingsConfigWebModule(withoutSettings), false)
  assert.equal(canManageCompanyAreasWeb(withSettings), false)
})

test("work_orders operativas respetan module_visibility", () => {
  const withWorkOrders = buildSessionUser({
    systemRole: "administrativo",
    roleCode: "ventas",
    moduleVisibility: {
      ...createEmptyModuleVisibility(),
      work_orders: true,
    },
  })
  const withPlanningOnly = buildSessionUser({
    systemRole: "administrativo",
    roleCode: "rrhh",
    moduleVisibility: {
      ...createEmptyModuleVisibility(),
      planificacion: true,
    },
  })

  assert.equal(canUseWorkOrdersWebOperationalActions(withWorkOrders), true)
  assert.equal(canUseWorkOrdersWebOperationalActions(withPlanningOnly), true)
  assert.equal(
    canUseWorkOrdersWebOperationalActions(
      buildSessionUser({
        systemRole: "administrativo",
        roleCode: "rrhh",
        moduleVisibility: createEmptyModuleVisibility(),
      })
    ),
    false
  )
})

test("middleware planificacion usa metadata allowed_modules", () => {
  assert.equal(
    canAccessPlanificacionFromAuthMetadata(
      { allowed_modules: ["planificacion"] },
      "administrativo"
    ),
    true
  )
  assert.equal(
    canAccessPlanificacionFromAuthMetadata({}, "administrativo"),
    false
  )
  assert.equal(
    canAccessPlanificacionFromAuthMetadata({}, "supervisor"),
    true
  )
})

test("eliminación permanente sigue reservada al administrador", () => {
  assert.equal(canPermanentlyDeleteWorkOrder("administrador", "finalizada"), true)
  assert.equal(canPermanentlyDeleteWorkOrder("supervisor", "finalizada"), false)
  assert.equal(canPermanentlyDeleteWorkOrder("administrativo", "finalizada"), false)
})
