/**
 * Sprint 30.0 — AUTH SYNC reuses employee/role from session (no double lookup).
 */
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()

test("Sprint 30.0: sync-my-metadata passes AuthSyncContext (no second employeeId fetch)", () => {
  const route = readFileSync(
    join(ROOT, "app/api/auth/sync-my-metadata/route.ts"),
    "utf8"
  )
  assert.ok(route.includes("getSessionUserWithAuthSyncContext"))
  assert.ok(route.includes("syncEmployeeAuthMetadata(loaded.context)"))
  assert.equal(route.includes("syncEmployeeAuthMetadata(employeeId)"), false)
  assert.equal(route.includes("requireWritablePlatformSession"), false)
})

test("Sprint 30.0: syncEmployeeAuthMetadata accepts AuthSyncContext and skips DB when provided", () => {
  const sync = readFileSync(
    join(ROOT, "lib/auth/sync-employee-auth-metadata.ts"),
    "utf8"
  )
  assert.ok(sync.includes("export type AuthSyncContext"))
  assert.ok(sync.includes("input: string | AuthSyncContext"))
  assert.ok(sync.includes("isAuthSyncContext(input)"))

  // Context path must not call fetchEmployeeById / fetchCompanyRoleById.
  const resolveFn = sync.slice(
    sync.indexOf("async function resolveEmployeeAndRole"),
    sync.indexOf("export async function syncEmployeeAuthMetadata")
  )
  assert.ok(resolveFn.includes("if (isAuthSyncContext(input))"))
  assert.ok(
    resolveFn.includes("return { ok: true, employee: input.employee, role: input.role }")
  )
})

test("Sprint 30.0: session exposes getSessionUserWithAuthSyncContext", () => {
  const session = readFileSync(join(ROOT, "lib/auth/session.ts"), "utf8")
  assert.ok(session.includes("export async function getSessionUserWithAuthSyncContext"))
  assert.ok(session.includes("AuthSyncContext"))
  assert.ok(session.includes("loadSessionUserParts"))
})
