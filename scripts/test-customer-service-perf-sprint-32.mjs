/**
 * Sprint 32.0 — release-expired uses JWT metadata (no getSessionUser / employees / roles).
 */
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  addReleaseExpiredTimer,
  recordReleaseExpiredCall,
  recordReleaseExpiredQuery,
  runWithReleaseExpiredPerf,
} from "../lib/customer-service/performance/release-expired-breakdown.ts"
import { setCustomerServicePerfEnabledForTests } from "../lib/customer-service/performance/enabled.ts"

const ROOT = process.cwd()

test("Sprint 32.0: route uses requireReleaseExpiredAuthContext (not getSessionUser)", () => {
  const route = readFileSync(
    join(
      ROOT,
      "app/api/atencion-cliente/release-expired-managements/route.ts"
    ),
    "utf8"
  )
  assert.ok(route.includes("runWithReleaseExpiredPerf"))
  assert.ok(route.includes("requireReleaseExpiredAuthContext"))
  assert.ok(route.includes("releaseExpiredCustomerAtencionManagements"))
  assert.equal(route.includes("requireAtencionClienteMutationContext"), false)
  assert.equal(route.includes("getSessionUser"), false)
})

test("Sprint 32.0: release-expired auth helper is JWT-only (no employees/company_roles)", () => {
  const auth = readFileSync(
    join(ROOT, "lib/customer-atenciones/release-expired-auth.server.ts"),
    "utf8"
  )
  assert.ok(auth.includes("getAuthUser"))
  assert.ok(auth.includes("user_metadata"))
  assert.ok(auth.includes("company_id"))
  assert.ok(auth.includes("employee_id"))
  assert.ok(auth.includes("hasWebModuleAccessFromMetadata"))
  assert.ok(auth.includes("isDemoPlatformReadOnlyUser"))

  assert.equal(auth.includes("fetchEmployeeByAppUserId"), false)
  assert.equal(auth.includes("fetchCompanyRoleById"), false)
  assert.equal(auth.includes("requireWritablePlatformSession"), false)
  assert.equal(auth.includes("buildSessionUserFromAuthUser"), false)
  assert.equal(auth.includes("supabase.auth.getUser()"), false)
})

test("Sprint 32.0: auth helper records sessionUserMs and zero employee/role", () => {
  const auth = readFileSync(
    join(ROOT, "lib/customer-atenciones/release-expired-auth.server.ts"),
    "utf8"
  )
  assert.ok(auth.includes('addReleaseExpiredTimer("sessionUserMs"'))
  assert.ok(auth.includes('addReleaseExpiredTimer("employeeMs", 0)'))
  assert.ok(auth.includes('addReleaseExpiredTimer("roleMs", 0)'))
  assert.ok(auth.includes('recordReleaseExpiredQuery("auth.getUser"'))
})

test("Sprint 32.0: RPC path and Sprint 31 log blocks remain", () => {
  const server = readFileSync(
    join(ROOT, "lib/customer-atenciones/consultation-management.server.ts"),
    "utf8"
  )
  assert.ok(server.includes('addReleaseExpiredTimer("rpcMs"'))
  assert.ok(server.includes('recordReleaseExpiredQuery("rpc.release_expired"'))

  const profiler = readFileSync(
    join(
      ROOT,
      "lib/customer-service/performance/release-expired-breakdown.ts"
    ),
    "utf8"
  )
  assert.ok(profiler.includes("[ATC RELEASE EXPIRED]"))
  assert.ok(profiler.includes("[ATC RELEASE EXPIRED QUERY]"))
  assert.ok(profiler.includes("[ATC RELEASE EXPIRED DUPLICATE]"))
})

test("Sprint 32.0: profiler still emits RELEASE EXPIRED blocks with zero employee/role", async () => {
  setCustomerServicePerfEnabledForTests(true)
  const logs = []
  const originalInfo = console.info
  console.info = (...args) => {
    logs.push(args.map(String).join(" "))
  }

  try {
    await runWithReleaseExpiredPerf(async () => {
      addReleaseExpiredTimer("sessionUserMs", 220)
      addReleaseExpiredTimer("employeeMs", 0)
      addReleaseExpiredTimer("roleMs", 0)
      addReleaseExpiredTimer("rpcMs", 93)
      addReleaseExpiredTimer("parseMs", 0)
      recordReleaseExpiredQuery("auth.getUser", 210)
      recordReleaseExpiredQuery("rpc.release_expired", 93)
      recordReleaseExpiredCall("getUser()")
    })

    const joined = logs.join("\n")
    assert.ok(joined.includes("[ATC RELEASE EXPIRED]"))
    assert.ok(joined.includes("Session User"))
    assert.ok(joined.includes("Employee"))
    assert.ok(joined.includes("Role"))
    assert.ok(joined.includes("RPC"))
    assert.ok(joined.includes("[ATC RELEASE EXPIRED QUERY]"))
    assert.ok(joined.includes("auth.getUser"))
    assert.ok(joined.includes("rpc.release_expired"))
    assert.equal(joined.includes("employees"), false)
    assert.equal(joined.includes("company_roles"), false)
    assert.ok(joined.includes("[ATC RELEASE EXPIRED DUPLICATE]"))
    assert.ok(joined.includes("(none)"))
  } finally {
    console.info = originalInfo
    setCustomerServicePerfEnabledForTests(null)
  }
})
