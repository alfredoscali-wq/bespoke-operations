import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  ADMIN_EMPLOYEE_NOT_ACCESSIBLE_ERROR,
  ADMIN_EMPLOYEE_NOT_ACCESSIBLE_STATUS,
  decideAdminAuthEmployeeAccess,
  resolveAdminEmployeeTenantAccess,
} from "../lib/auth/admin-employee-tenant.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const TENANT_A = "00000000-0000-4000-8000-aaaaaaaaaaa1"
const TENANT_B = "00000000-0000-4000-8000-bbbbbbbbbbb2"
const EMPLOYEE_A = "00000000-0000-4000-8000-eeeeeeeeeea1"
const EMPLOYEE_B = "00000000-0000-4000-8000-eeeeeeeeeeeb2"

const adminTenantA = {
  systemRole: "administrador",
  companyId: TENANT_A,
}

const employeeTenantA = { id: EMPLOYEE_A, companyId: TENANT_A }
const employeeTenantB = { id: EMPLOYEE_B, companyId: TENANT_B }

const softDeleteRoute = read("app/api/auth/soft-delete-employee/route.ts")
const syncRoute = read("app/api/auth/sync-employee-metadata/route.ts")
const syncMyRoute = read("app/api/auth/sync-my-metadata/route.ts")
const softDeleteService = read("lib/auth/soft-delete-employee-access.ts")
const syncService = read("lib/auth/sync-employee-auth-metadata.ts")
const disableService = read("lib/auth/provision-employee.ts")

const softDeleteFn = softDeleteService.slice(
  softDeleteService.indexOf("export async function softDeleteEmployeeAccess")
)
const disableFn = disableService.slice(
  disableService.indexOf("export async function disableEmployeeAccess")
)
const resolveFn = syncService.slice(
  syncService.indexOf("async function resolveEmployeeAndRole"),
  syncService.indexOf("export async function syncEmployeeAuthMetadata")
)
const syncFn = syncService.slice(
  syncService.indexOf("export async function syncEmployeeAuthMetadata"),
  syncService.indexOf("export async function syncEmployeesAuthMetadataByRoleId")
)

function assertNoAuthSideEffects(decision) {
  assert.equal(decision.allow, false)
  assert.equal(decision.sideEffects.createUser, false)
  assert.equal(decision.sideEffects.updateUserById, false)
  assert.equal(decision.sideEffects.patchEmployee, false)
  assert.equal(decision.sideEffects.passwordChanged, false)
  assert.equal(decision.sideEffects.mustChangePasswordChanged, false)
}

function assertDeniedCrossTenant(decision) {
  assertNoAuthSideEffects(decision)
  assert.equal(decision.reason, "not_accessible")
  assert.equal(decision.status, ADMIN_EMPLOYEE_NOT_ACCESSIBLE_STATUS)
  assert.equal(decision.error, ADMIN_EMPLOYEE_NOT_ACCESSIBLE_ERROR)
  assert.equal(decision.error.includes(TENANT_B), false)
}

test("1. soft-delete: sin sesión → DENY", () => {
  const decision = decideAdminAuthEmployeeAccess({
    sessionUser: null,
    employee: employeeTenantA,
  })
  assertNoAuthSideEffects(decision)
  assert.equal(decision.status, 401)
  assert.match(softDeleteRoute, /getSessionUser\(\)/)
  assert.match(softDeleteRoute, /status: 401/)
})

test("2. soft-delete: no admin → DENY", () => {
  const decision = decideAdminAuthEmployeeAccess({
    sessionUser: { systemRole: "operario", companyId: TENANT_A },
    employee: employeeTenantA,
  })
  assertNoAuthSideEffects(decision)
  assert.equal(decision.status, 403)
  assert.match(softDeleteRoute, /systemRole !== "administrador"/)
})

test("3. soft-delete: admin sin companyId → DENY", () => {
  const decision = decideAdminAuthEmployeeAccess({
    sessionUser: { systemRole: "administrador", companyId: null },
    employee: employeeTenantA,
  })
  assertNoAuthSideEffects(decision)
  assert.equal(decision.status, 403)
  assert.match(softDeleteRoute, /ADMIN_SESSION_COMPANY_UNAVAILABLE_ERROR/)
})

test("4. soft-delete: same tenant → ALLOW", () => {
  const decision = decideAdminAuthEmployeeAccess({
    sessionUser: adminTenantA,
    employee: employeeTenantA,
  })
  assert.equal(decision.allow, true)
})

test("5. soft-delete: cross tenant → DENY", () => {
  assertDeniedCrossTenant(
    decideAdminAuthEmployeeAccess({
      sessionUser: adminTenantA,
      employee: employeeTenantB,
    })
  )
})

test("6. soft-delete: employee inexistente → DENY", () => {
  assertDeniedCrossTenant(
    decideAdminAuthEmployeeAccess({
      sessionUser: adminTenantA,
      employee: null,
    })
  )
})

test("7-9. soft-delete: cross-tenant no patch / ban / deleted_at", () => {
  const tenantIdx = softDeleteFn.indexOf("resolveAdminEmployeeTenantAccess")
  const patchIdx = softDeleteFn.indexOf("patchEmployee")
  const banIdx = softDeleteFn.indexOf("updateUserById")
  const deleteIdx = softDeleteFn.indexOf("softDeleteEmployee(")

  assert.ok(tenantIdx >= 0)
  assert.ok(tenantIdx < patchIdx)
  assert.ok(tenantIdx < banIdx)
  assert.ok(tenantIdx < deleteIdx)

  const denied = resolveAdminEmployeeTenantAccess({
    sessionCompanyId: TENANT_A,
    employeeCompanyId: TENANT_B,
    employeeFound: true,
  })
  assert.equal(denied.ok, false)
})

test("10. soft-delete: company_id del body no autoriza", () => {
  assert.doesNotMatch(softDeleteRoute, /body\.company/i)
  assert.doesNotMatch(softDeleteRoute, /company_id/)
  assertDeniedCrossTenant(
    decideAdminAuthEmployeeAccess({
      sessionUser: adminTenantA,
      employee: employeeTenantB,
      requestBodyCompanyId: TENANT_B,
    })
  )
  const sameTenant = decideAdminAuthEmployeeAccess({
    sessionUser: adminTenantA,
    employee: employeeTenantA,
    requestBodyCompanyId: TENANT_B,
  })
  assert.equal(sameTenant.allow, true)
})

test("11. soft-delete: UUID de otro tenant → DENY", () => {
  assertDeniedCrossTenant(
    decideAdminAuthEmployeeAccess({
      sessionUser: adminTenantA,
      employee: { id: EMPLOYEE_B, companyId: TENANT_B },
    })
  )
})

test("12. soft-delete: tenant check ocurre antes de cualquier mutación", () => {
  const sessionIdx = softDeleteRoute.indexOf("getSessionUser()")
  const adminIdx = softDeleteRoute.indexOf('systemRole !== "administrador"')
  const companyIdx = softDeleteRoute.indexOf("sessionUser.companyId")
  const serviceIdx = softDeleteRoute.indexOf("softDeleteEmployeeAccess(")
  assert.ok(sessionIdx < adminIdx)
  assert.ok(adminIdx < companyIdx)
  assert.ok(companyIdx < serviceIdx)
  assert.match(
    softDeleteRoute,
    /softDeleteEmployeeAccess\(employeeId, sessionCompanyId\)/
  )
  assert.match(softDeleteRoute, /ADMIN_EMPLOYEE_NOT_ACCESSIBLE_STATUS/)
  assert.doesNotMatch(softDeleteRoute, /recordUser/)
})

test("13. sync-employee-metadata: sin sesión → DENY", () => {
  const decision = decideAdminAuthEmployeeAccess({
    sessionUser: null,
    employee: employeeTenantA,
  })
  assertNoAuthSideEffects(decision)
  assert.equal(decision.status, 401)
  assert.match(syncRoute, /requireAdministratorSession/)
})

test("14. sync-employee-metadata: no admin → DENY", () => {
  const decision = decideAdminAuthEmployeeAccess({
    sessionUser: { systemRole: "supervisor", companyId: TENANT_A },
    employee: employeeTenantA,
  })
  assertNoAuthSideEffects(decision)
  assert.equal(decision.status, 403)
})

test("15. sync-employee-metadata: same tenant → ALLOW", () => {
  const decision = decideAdminAuthEmployeeAccess({
    sessionUser: adminTenantA,
    employee: employeeTenantA,
  })
  assert.equal(decision.allow, true)
})

test("16. sync-employee-metadata: cross tenant → DENY", () => {
  assertDeniedCrossTenant(
    decideAdminAuthEmployeeAccess({
      sessionUser: adminTenantA,
      employee: employeeTenantB,
    })
  )
})

test("17. sync-employee-metadata: cross-tenant no updateUserById", () => {
  const tenantIdx = resolveFn.indexOf("resolveAdminEmployeeTenantAccess")
  const roleIdx = resolveFn.indexOf("fetchCompanyRoleById")
  const updateIdx = syncFn.indexOf("updateUserById")
  assert.ok(tenantIdx >= 0)
  assert.ok(tenantIdx < roleIdx)
  assert.ok(updateIdx >= 0)
  assert.match(
    syncRoute,
    /syncEmployeeAuthMetadata\(employeeId, sessionCompanyId\)/
  )
})

test("18. sync-employee-metadata: employee inexistente → DENY", () => {
  assertDeniedCrossTenant(
    decideAdminAuthEmployeeAccess({
      sessionUser: adminTenantA,
      employee: null,
    })
  )
  assert.match(syncRoute, /ADMIN_EMPLOYEE_NOT_ACCESSIBLE_STATUS/)
})

test("19. sync-employee-metadata: company_id del body no autoriza", () => {
  assert.doesNotMatch(syncRoute, /body\.company/i)
  assert.doesNotMatch(syncRoute, /company_id/)
  assertDeniedCrossTenant(
    decideAdminAuthEmployeeAccess({
      sessionUser: adminTenantA,
      employee: employeeTenantB,
      requestBodyCompanyId: TENANT_A,
    })
  )
})

test("sync-my-metadata no se fabrica desde employeeId HTTP", () => {
  assert.match(syncMyRoute, /syncEmployeeAuthMetadata\(loaded\.context\)/)
  assert.equal(syncMyRoute.includes("syncEmployeeAuthMetadata(employeeId)"), false)
  assert.doesNotMatch(syncRoute, /AuthSyncContext/)
  assert.doesNotMatch(syncRoute, /loaded\.context/)
})

test("20. disableEmployeeAccess exige tenant context", () => {
  assert.match(
    disableFn,
    /disableEmployeeAccess\(\s*employeeId: string,\s*sessionCompanyId: string/
  )
  assert.match(disableFn, /resolveAdminEmployeeTenantAccess/)
})

test("21. disableEmployeeAccess: tenant check antes de deleteUser", () => {
  const tenantIdx = disableFn.indexOf("resolveAdminEmployeeTenantAccess")
  const deleteIdx = disableFn.indexOf("deleteUser")
  const patchIdx = disableFn.indexOf("patchEmployee")
  assert.ok(tenantIdx >= 0)
  assert.ok(tenantIdx < deleteIdx)
  assert.ok(tenantIdx < patchIdx)
})

test("22. disableEmployeeAccess no tiene callers que rompan el contrato", () => {
  const provisionEmployee = read("lib/auth/provision-employee.ts")
  const routes = [
    "app/api/auth/soft-delete-employee/route.ts",
    "app/api/auth/sync-employee-metadata/route.ts",
    "app/api/auth/provision/route.ts",
    "app/api/auth/reset-password/route.ts",
    "app/api/auth/sync-my-metadata/route.ts",
    "app/api/auth/sync-role-metadata/route.ts",
  ]

  assert.match(provisionEmployee, /export async function disableEmployeeAccess/)
  for (const relative of routes) {
    const source = read(relative)
    assert.equal(
      source.includes("disableEmployeeAccess("),
      false,
      `${relative} no debe llamar disableEmployeeAccess`
    )
  }
})
