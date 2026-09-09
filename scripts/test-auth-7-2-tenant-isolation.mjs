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

const provisionRoute = read("app/api/auth/provision/route.ts")
const resetRoute = read("app/api/auth/reset-password/route.ts")
const provisionService = read("lib/auth/auth-provisioning-service.ts")
const resetService = read("lib/auth/reset-employee-password.ts")

const provisionFn = provisionService.slice(
  provisionService.indexOf(
    "export async function provisionAuthIdentityForEmployee"
  ),
  provisionService.indexOf("export async function provisionEmployeeAccess")
)
const resetFn = resetService.slice(
  resetService.indexOf("export async function resetEmployeePassword")
)

function assertNoAuthSideEffects(decision) {
  assert.equal(decision.allow, false)
  assert.equal(decision.sideEffects.createUser, false)
  assert.equal(decision.sideEffects.updateUserById, false)
  assert.equal(decision.sideEffects.patchEmployee, false)
  assert.equal(decision.sideEffects.passwordChanged, false)
  assert.equal(decision.sideEffects.mustChangePasswordChanged, false)
  assert.equal(decision.sideEffects.recordUserCreate, false)
  assert.equal(decision.sideEffects.recordUserProvision, false)
  assert.equal(decision.sideEffects.recordUserPasswordReset, false)
}

function assertDeniedCrossTenant(decision) {
  assertNoAuthSideEffects(decision)
  assert.equal(decision.reason, "not_accessible")
  assert.equal(decision.status, ADMIN_EMPLOYEE_NOT_ACCESSIBLE_STATUS)
  assert.equal(decision.error, ADMIN_EMPLOYEE_NOT_ACCESSIBLE_ERROR)
  assert.doesNotMatch(decision.error, /empresa X/i)
  assert.equal(decision.error.includes(TENANT_B), false)
  assert.doesNotMatch(decision.error, /pertenece/i)
}

test("1. provision: admin tenant A + employee tenant A → SUCCESS", () => {
  const decision = decideAdminAuthEmployeeAccess({
    sessionUser: adminTenantA,
    employee: employeeTenantA,
  })
  assert.equal(decision.allow, true)
  if (decision.allow) {
    assert.equal(decision.sessionCompanyId, TENANT_A)
  }
})

test("2. provision: admin tenant A + employee tenant B → DENIED, sin side effects", () => {
  assertDeniedCrossTenant(
    decideAdminAuthEmployeeAccess({
      sessionUser: adminTenantA,
      employee: employeeTenantB,
    })
  )
})

test("3. provision: UUID manipulado apuntando a tenant B → DENIED, sin side effects", () => {
  assertDeniedCrossTenant(
    decideAdminAuthEmployeeAccess({
      sessionUser: adminTenantA,
      employee: { id: "ffffffff-ffff-4000-8000-ffffffffffff", companyId: TENANT_B },
    })
  )
})

test("4. provision: company_id del body = tenant B no autoriza → DENIED si employee es B", () => {
  assertDeniedCrossTenant(
    decideAdminAuthEmployeeAccess({
      sessionUser: adminTenantA,
      employee: employeeTenantB,
      requestBodyCompanyId: TENANT_B,
    })
  )
})

test("4b. provision: company_id del body = tenant B no impide employee del tenant A", () => {
  const decision = decideAdminAuthEmployeeAccess({
    sessionUser: adminTenantA,
    employee: employeeTenantA,
    requestBodyCompanyId: TENANT_B,
  })
  assert.equal(decision.allow, true)
})

test("5. provision: sin sesión → DENIED, sin side effects", () => {
  const decision = decideAdminAuthEmployeeAccess({
    sessionUser: null,
    employee: employeeTenantA,
  })
  assertNoAuthSideEffects(decision)
  assert.equal(decision.reason, "unauthenticated")
  assert.equal(decision.status, 401)
})

test("6. provision: autenticado sin admin → DENIED, sin side effects", () => {
  const decision = decideAdminAuthEmployeeAccess({
    sessionUser: { systemRole: "operario", companyId: TENANT_A },
    employee: employeeTenantA,
  })
  assertNoAuthSideEffects(decision)
  assert.equal(decision.reason, "forbidden_role")
  assert.equal(decision.status, 403)
})

test("7. reset: admin tenant A + employee tenant A → SUCCESS", () => {
  const decision = decideAdminAuthEmployeeAccess({
    sessionUser: adminTenantA,
    employee: employeeTenantA,
  })
  assert.equal(decision.allow, true)
})

test("8. reset: admin tenant A + employee tenant B → DENIED, sin side effects", () => {
  assertDeniedCrossTenant(
    decideAdminAuthEmployeeAccess({
      sessionUser: adminTenantA,
      employee: employeeTenantB,
    })
  )
})

test("9. reset: UUID manipulado → DENIED, sin side effects", () => {
  assertDeniedCrossTenant(
    decideAdminAuthEmployeeAccess({
      sessionUser: adminTenantA,
      employee: { id: EMPLOYEE_B, companyId: TENANT_B },
    })
  )
})

test("10. reset: company_id manipulado en body no autoriza cross-tenant", () => {
  assertDeniedCrossTenant(
    decideAdminAuthEmployeeAccess({
      sessionUser: adminTenantA,
      employee: employeeTenantB,
      requestBodyCompanyId: TENANT_B,
    })
  )
})

test("11. reset: sin sesión → DENIED, sin side effects", () => {
  const decision = decideAdminAuthEmployeeAccess({
    sessionUser: null,
    employee: employeeTenantA,
  })
  assertNoAuthSideEffects(decision)
  assert.equal(decision.status, 401)
})

test("12. reset: autenticado sin admin → DENIED, sin side effects", () => {
  const decision = decideAdminAuthEmployeeAccess({
    sessionUser: { systemRole: "supervisor", companyId: TENANT_A },
    employee: employeeTenantA,
  })
  assertNoAuthSideEffects(decision)
  assert.equal(decision.status, 403)
})

test("employee inexistente se trata como no accesible, sin filtrar tenant", () => {
  const decision = decideAdminAuthEmployeeAccess({
    sessionUser: adminTenantA,
    employee: null,
  })
  assertDeniedCrossTenant(decision)
})

test("rutas: sesión y rol admin se exigen antes de service_role Auth", () => {
  for (const [name, source] of [
    ["provision", provisionRoute],
    ["reset", resetRoute],
  ]) {
    const sessionIdx = source.indexOf("getSessionUser()")
    const adminIdx = source.indexOf('systemRole !== "administrador"')
    const companyIdx = source.indexOf("sessionUser.companyId")
    const serviceIdx =
      name === "provision"
        ? source.indexOf("provisionAuthIdentityForEmployee(")
        : source.indexOf("resetEmployeePassword(")

    assert.ok(sessionIdx >= 0, `${name}: getSessionUser`)
    assert.ok(adminIdx >= 0, `${name}: admin role`)
    assert.ok(companyIdx >= 0, `${name}: session.companyId`)
    assert.ok(serviceIdx >= 0, `${name}: service call`)
    assert.ok(sessionIdx < adminIdx, `${name}: session before role`)
    assert.ok(adminIdx < companyIdx, `${name}: role before company`)
    assert.ok(companyIdx < serviceIdx, `${name}: company before service_role`)
  }
})

test("rutas: no autorizan con company_id del body", () => {
  assert.doesNotMatch(provisionRoute, /body\.company/i)
  assert.doesNotMatch(resetRoute, /body\.company/i)
  assert.match(provisionRoute, /employeeId\?: string/)
  assert.doesNotMatch(provisionRoute, /company_id/)
  assert.doesNotMatch(resetRoute, /company_id/)
  assert.match(
    provisionRoute,
    /provisionAuthIdentityForEmployee\(\s*employeeId,\s*sessionCompanyId\s*\)/
  )
  assert.match(
    resetRoute,
    /resetEmployeePassword\(employeeId, sessionCompanyId\)/
  )
})

test("provision service: tenant check ocurre antes de createUser / metadata / link", () => {
  const tenantIdx = provisionFn.indexOf("resolveAdminEmployeeTenantAccess")
  const createIdx = provisionFn.indexOf("createAuthUserForEmployee")
  const findDniIdx = provisionFn.indexOf("findAuthUserByDni")
  const unbanIdx = provisionFn.indexOf("unbanAuthUserIfNeeded")
  const linkIdx = provisionFn.indexOf("linkEmployeeToAuthUser")
  const syncIdx = provisionFn.indexOf("syncProvisionedMetadata")

  assert.ok(tenantIdx >= 0)
  assert.ok(tenantIdx < createIdx)
  assert.ok(tenantIdx < findDniIdx)
  assert.ok(tenantIdx < unbanIdx)
  assert.ok(tenantIdx < linkIdx)
  assert.ok(tenantIdx < syncIdx)
  assert.ok(tenantIdx < provisionFn.indexOf("if (!employee.systemAccess)"))
})

test("reset service: tenant check ocurre antes de updateUserById / patch / metadata", () => {
  const tenantIdx = resetFn.indexOf("resolveAdminEmployeeTenantAccess")
  const updateIdx = resetFn.indexOf("updateUserById")
  const patchIdx = resetFn.indexOf("patchEmployee")
  const syncIdx = resetFn.indexOf("syncEmployeeAuthMetadata")
  const validateIdx = resetFn.indexOf("validateEmployeeForPasswordReset")

  assert.ok(tenantIdx >= 0)
  assert.ok(tenantIdx < updateIdx)
  assert.ok(tenantIdx < patchIdx)
  assert.ok(tenantIdx < syncIdx)
  assert.ok(tenantIdx < validateIdx)
})

test("rutas: Activity de éxito solo después de result.success", () => {
  const provisionSuccessIdx = provisionRoute.indexOf("if (!result.success)")
  const createAuditIdx = provisionRoute.indexOf("await recordUserCreateAudit")
  const provisionAuditIdx = provisionRoute.indexOf("await recordUserProvisionAudit")
  assert.ok(provisionSuccessIdx >= 0)
  assert.ok(createAuditIdx > provisionSuccessIdx)
  assert.ok(provisionAuditIdx > provisionSuccessIdx)

  const resetSuccessIdx = resetRoute.indexOf("if (!result.success)")
  const resetAuditIdx = resetRoute.indexOf("await recordUserPasswordResetAudit")
  assert.ok(resetSuccessIdx >= 0)
  assert.ok(resetAuditIdx > resetSuccessIdx)
})

test("cross-tenant usa el mismo error que recurso no accesible", () => {
  const denied = resolveAdminEmployeeTenantAccess({
    sessionCompanyId: TENANT_A,
    employeeCompanyId: TENANT_B,
    employeeFound: true,
  })
  const missing = resolveAdminEmployeeTenantAccess({
    sessionCompanyId: TENANT_A,
    employeeCompanyId: undefined,
    employeeFound: false,
  })
  assert.deepEqual(denied, missing)
  assert.equal(denied.ok, false)
  assert.equal(denied.error, ADMIN_EMPLOYEE_NOT_ACCESSIBLE_ERROR)
  assert.match(provisionRoute, /ADMIN_EMPLOYEE_NOT_ACCESSIBLE_STATUS/)
  assert.match(resetRoute, /ADMIN_EMPLOYEE_NOT_ACCESSIBLE_STATUS/)
})
