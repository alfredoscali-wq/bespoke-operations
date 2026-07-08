import assert from "node:assert/strict"
import test from "node:test"

import {
  createEmptyModuleVisibility,
  resolveModuleKeyFromPathname,
} from "../lib/roles/app-modules.ts"
import { hasWebModuleAccess } from "../lib/roles/web-module-access.ts"

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
    roleCode: overrides.roleCode ?? "atencion_cliente",
    roleName: overrides.roleName ?? "Atención al Cliente",
    moduleVisibility,
    visibleModuleKeys: [],
    nationalId: null,
    mustChangePassword: false,
    email: "test@example.com",
    ...overrides,
  }
}

test("resolveModuleKeyFromPathname resuelve atencion_cliente", () => {
  assert.equal(resolveModuleKeyFromPathname("/atencion-cliente"), "atencion_cliente")
  assert.equal(
    resolveModuleKeyFromPathname("/atencion-cliente/abc-123"),
    "atencion_cliente"
  )
})

test("administrador tiene acceso web al módulo atencion_cliente", () => {
  const sessionUser = buildSessionUser({
    systemRole: "administrador",
    roleCode: "administrador",
    moduleVisibility: createEmptyModuleVisibility(),
  })

  assert.equal(hasWebModuleAccess(sessionUser, "atencion_cliente"), true)
})

test("administrativo con atencion_cliente visible puede acceder", () => {
  const sessionUser = buildSessionUser({
    systemRole: "administrativo",
    roleCode: "atencion_cliente",
    moduleVisibility: {
      ...createEmptyModuleVisibility(),
      atencion_cliente: true,
    },
  })

  assert.equal(hasWebModuleAccess(sessionUser, "atencion_cliente"), true)
})

test("administrativo sin atencion_cliente visible no puede acceder", () => {
  const sessionUser = buildSessionUser({
    systemRole: "administrativo",
    roleCode: "administracion",
    moduleVisibility: createEmptyModuleVisibility(),
  })

  assert.equal(hasWebModuleAccess(sessionUser, "atencion_cliente"), false)
})
