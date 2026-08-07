/**
 * Sprint 38.0 — JWT auth context for ATC actions (no employees / company_roles).
 * Sprint 44.0 — employees fallback only when JWT company_id/employee_id missing.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()

const ACTION_ROUTES = [
  "app/api/atencion-cliente/[atencionId]/start-management/route.ts",
  "app/api/atencion-cliente/[atencionId]/touch-management/route.ts",
  "app/api/atencion-cliente/[atencionId]/defer/route.ts",
  "app/api/atencion-cliente/[atencionId]/resolve/route.ts",
]

test("Sprint 38.0: action-auth helper is JWT-first (Sprint 44 employees gap-fill)", () => {
  const auth = readFileSync(
    join(ROOT, "lib/customer-atenciones/action-auth.server.ts"),
    "utf8"
  )
  assert.ok(auth.includes("export async function getCustomerActionAuthContext"))
  assert.ok(auth.includes("export async function requireCustomerActionAuthContext"))
  assert.ok(auth.includes("getAuthUser"))
  assert.ok(auth.includes("company_id"))
  assert.ok(auth.includes("employee_id"))
  assert.ok(auth.includes("role_id"))
  assert.ok(auth.includes("hasWebModuleAccessFromMetadata"))
  assert.ok(auth.includes("isDemoPlatformReadOnlyUser"))

  // Sprint 44.0 — gap-fill from employees when JWT metadata incomplete.
  assert.ok(auth.includes("fetchEmployeeByAppUserId"))
  assert.ok(auth.includes("!companyId || !employeeId"))
  assert.equal(auth.includes("fetchCompanyRoleById"), false)
  assert.equal(auth.includes("requireWritablePlatformSession"), false)
  assert.equal(auth.includes("buildSessionUserFromAuthUser"), false)
  assert.equal(auth.includes("getSessionUser"), false)
  assert.equal(auth.includes("supabase.auth.getUser()"), false)
})

test("Sprint 38.0: action routes use requireCustomerActionAuthContext", () => {
  for (const relative of ACTION_ROUTES) {
    const source = readFileSync(join(ROOT, relative), "utf8")
    assert.ok(
      source.includes("requireCustomerActionAuthContext"),
      `${relative} missing JWT auth helper`
    )
    assert.equal(
      source.includes("requireAtencionClienteMutationContext"),
      false,
      `${relative} still uses SessionUser mutation context`
    )
    assert.ok(
      source.includes("runWithAtcActionPerf"),
      `${relative} must keep Sprint 37 profiler`
    )
  }
})

test("Sprint 38.0: auth helper records zero employees/company_roles for profiler", () => {
  const auth = readFileSync(
    join(ROOT, "lib/customer-atenciones/action-auth.server.ts"),
    "utf8"
  )
  assert.ok(auth.includes('recordAtcActionQuery("auth.getUser"'))
  assert.ok(auth.includes('recordAtcActionQuery("employees", 0)'))
  assert.ok(auth.includes('recordAtcActionQuery("company_roles", 0)'))
})
