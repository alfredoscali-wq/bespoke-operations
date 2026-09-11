import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import test from "node:test"

import { mapMobileAuthProfile } from "../lib/mobile/v1/auth/map-mobile-auth-profile.ts"
import { mapMobileLoginUser } from "../lib/mobile/v1/auth/map-mobile-user-response.ts"
import { validateMobileChangePasswordRequest } from "../lib/mobile/v1/auth/validate-change-password-request.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

function sliceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle)
  const end = endNeedle ? source.indexOf(endNeedle, start + 1) : source.length
  assert.ok(start >= 0, `missing ${startNeedle}`)
  if (endNeedle) assert.ok(end > start, `missing ${endNeedle}`)
  return source.slice(start, endNeedle ? end : source.length)
}

function walkRouteFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walkRouteFiles(full, acc)
    else if (name === "route.ts") acc.push(full)
  }
  return acc
}

function posix(path) {
  return path.replaceAll("\\", "/")
}

const resolver = read("lib/mobile/v1/auth/mobile-token-resolver.ts")
const resolverFn = sliceBetween(
  resolver,
  "export async function resolveMobileAuthFromAccessToken",
  ""
)
const middleware = read("lib/mobile/v1/auth/mobile-bearer-middleware.ts")
const loginService = read("lib/mobile/v1/auth/login-service.ts")
const meRoute = read("app/api/mobile/v1/auth/me/route.ts")
const changeRoute = read("app/api/mobile/v1/auth/change-password/route.ts")
const changeService = read("lib/mobile/v1/auth/change-password-service.ts")
const helperWeb = read("lib/auth/require-password-compliant-session.ts")
const webGuardUi = read("components/auth/password-change-guard.tsx")
const access = read("lib/mobile/v1/auth/assert-employee-mobile-access.ts")
const context = read("lib/mobile/v1/auth/mobile-auth-context.ts")
const helpers = read("lib/mobile/v1/auth/mobile-auth-helpers.ts")

const employeeFixture = {
  id: "emp-1",
  companyId: "co-1",
  systemRole: "operario",
  email: "op@example.com",
  mustChangePassword: true,
}

const sessionFixture = {
  authUserId: "auth-1",
  displayName: "Operario Uno",
  email: "auth@example.com",
  mustChangePassword: true,
}

const LEGACY_NOTE =
  "Legacy Field Agent compatibility: current deployed mobile client cannot handle PASSWORD_CHANGE_REQUIRED. Password-change enforcement for Mobile is temporarily disabled at the bearer gate until the client supports the change-password flow."

test("hotfix 1. must_change=false → login OK y APIs protegidas no bloquean por password", () => {
  const mapped = mapMobileLoginUser(
    { ...sessionFixture, mustChangePassword: false },
    { ...employeeFixture, mustChangePassword: false }
  )
  assert.equal(mapped.mustChangePassword, false)
  assert.match(loginService, /accessToken: session\.access_token/)
  assert.doesNotMatch(loginService, /denyIfPasswordChangeRequired/)
  assert.doesNotMatch(resolverFn, /denyIfPasswordChangeRequired/)
  assert.doesNotMatch(resolverFn, /throw new MobileApiError\(denial/)
  assert.doesNotMatch(resolverFn, /MOBILE_API_ERROR_MESSAGES\.PASSWORD_CHANGE_REQUIRED/)
  assert.match(resolverFn, /assertEmployeeCanUseMobile\(employee\)/)
})

test("hotfix 2. must_change=true → login OK y APIs protegidas no devuelven PASSWORD_CHANGE_REQUIRED", () => {
  const mapped = mapMobileLoginUser(sessionFixture, employeeFixture)
  assert.equal(mapped.mustChangePassword, true)
  assert.match(loginService, /accessToken: session\.access_token/)
  assert.match(loginService, /refreshToken: session\.refresh_token/)
  assert.doesNotMatch(loginService, /PASSWORD_CHANGE_REQUIRED/)
  assert.doesNotMatch(resolverFn, /denyIfPasswordChangeRequired/)
  assert.doesNotMatch(resolverFn, /throw new MobileApiError\(denial/)
  assert.doesNotMatch(resolverFn, /MOBILE_API_ERROR_MESSAGES\.PASSWORD_CHANGE_REQUIRED/)
  assert.match(resolverFn, /buildMobileAuthContext\(sessionUser, employee\)/)
})

test("hotfix 3. employees.must_change_password no se auto-limpia en login ni en el bearer gate", () => {
  assert.doesNotMatch(loginService, /patchEmployee/)
  assert.doesNotMatch(loginService, /mustChangePassword:\s*false/)
  assert.doesNotMatch(resolverFn, /patchEmployee/)
  assert.doesNotMatch(resolverFn, /mustChangePassword:\s*false/)
  assert.doesNotMatch(resolverFn, /must_change_password/)
})

test("hotfix 4. GET /auth/me sigue devolviendo mustChangePassword=true", () => {
  const profile = mapMobileAuthProfile({
    authUserId: "auth-1",
    employeeId: "emp-1",
    companyId: "co-1",
    role: "operario",
    email: "op@example.com",
    displayName: "Operario Uno",
    mustChangePassword: true,
  })
  assert.equal(profile.mustChangePassword, true)
  assert.match(meRoute, /mapMobileAuthProfile\(auth\)/)
  assert.match(context, /mustChangePassword: sessionUser\.mustChangePassword/)
})

test("hotfix 5. POST /auth/change-password sigue disponible", () => {
  assert.match(changeRoute, /changeMobilePassword/)
  assert.match(changeRoute, /extractBearerToken\(request\)/)
  assert.match(changeRoute, /requireAuthenticatedUser\(context\)/)
  assert.doesNotMatch(changeRoute, /denyIfPasswordChangeRequired/)
  const parsed = validateMobileChangePasswordRequest({
    newPassword: "abcdefgh",
    employeeId: "attacker-emp",
  })
  assert.deepEqual(parsed, { newPassword: "abcdefgh" })
})

test("hotfix 6. tras change-password correcto, must_change_password pasa a false", () => {
  assert.match(changeService, /mustChangePassword: false/)
  assert.match(
    changeService,
    /patchEmployee\(admin, input\.auth\.employeeId/
  )
  const changeFn = sliceBetween(
    changeService,
    "export async function changeMobilePassword",
    ""
  )
  assert.ok(
    changeFn.indexOf("updateAuthenticatedUserPassword") <
      changeFn.indexOf("mustChangePassword: false")
  )
})

test("hotfix 7. Web PasswordChangeGuard y denyIfPasswordChangeRequired siguen intactos", () => {
  assert.match(webGuardUi, /export function PasswordChangeGuard/)
  assert.match(webGuardUi, /sessionUser\.mustChangePassword/)
  assert.match(webGuardUi, /CHANGE_PASSWORD_PATH/)
  const denyFn = sliceBetween(
    helperWeb,
    "export function denyIfPasswordChangeRequired",
    "export function passwordChangeRequiredResponse"
  )
  assert.match(denyFn, /if \(!sessionUser\.mustChangePassword\) \{\s*return null/)
  assert.match(denyFn, /code: PASSWORD_CHANGE_REQUIRED_CODE/)
  assert.match(helperWeb, /PASSWORD_CHANGE_REQUIRED_STATUS = 403/)
  assert.match(
    read("lib/auth/require-administrator.ts"),
    /denyIfPasswordChangeRequired/
  )
  assert.match(
    read("lib/auth/require-writable-platform-session.ts"),
    /denyIfPasswordChangeRequired/
  )
  assert.doesNotMatch(helperWeb, /Legacy Field Agent compatibility/)
})

test("hotfix 8. USER_DISABLED, EMPLOYEE_NOT_FOUND e INVALID_CREDENTIALS no cambian", () => {
  assert.match(loginService, /INVALID_CREDENTIALS/)
  assert.match(loginService, /EMPLOYEE_NOT_FOUND/)
  assert.match(loginService, /assertEmployeeCanUseMobile/)
  assert.match(resolverFn, /UNAUTHORIZED/)
  assert.match(resolverFn, /EMPLOYEE_NOT_FOUND/)
  assert.match(resolverFn, /assertEmployeeCanUseMobile\(employee\)/)
  assert.match(access, /USER_DISABLED/)
  assert.doesNotMatch(access, /mustChangePassword/)
  assert.doesNotMatch(access, /PASSWORD_CHANGE_REQUIRED/)
  const missing = sliceBetween(
    middleware,
    'stage: "missing_bearer_token"',
    "resolveMobileAuthFromAccessToken"
  )
  assert.match(missing, /UNAUTHORIZED/)
  assert.match(missing, /,\s*401/)
  assert.doesNotMatch(missing, /PASSWORD_CHANGE_REQUIRED/)
  assert.ok(
    resolverFn.indexOf("UNAUTHORIZED") <
      resolverFn.indexOf("EMPLOYEE_NOT_FOUND")
  )
  assert.ok(
    resolverFn.indexOf("EMPLOYEE_NOT_FOUND") <
      resolverFn.indexOf("assertEmployeeCanUseMobile")
  )
})

test("hotfix 9. no hay bypass de tenant ni cambio de RLS/ACL en el gate Mobile", () => {
  assert.match(context, /companyId: employee\.companyId/)
  assert.match(helpers, /export function requireCompany/)
  assert.doesNotMatch(resolverFn, /createPolicy/)
  assert.doesNotMatch(resolverFn, /ENABLE ROW LEVEL SECURITY/)
  assert.doesNotMatch(resolverFn, /companyIdFromRequest/)
  assert.doesNotMatch(resolverFn, /x-company-id/)
  assert.doesNotMatch(loginService, /ENABLE ROW LEVEL SECURITY/)
})

test("hotfix 10. APIs protegidas siguen pasando por el bearer gate común", () => {
  const files = walkRouteFiles(join(root, "app", "api", "mobile", "v1"))
  const publicRoutes = new Set([
    "app/api/mobile/v1/auth/login/route.ts",
    "app/api/mobile/v1/auth/refresh/route.ts",
  ])
  const unguarded = []

  for (const file of files) {
    const rel = posix(relative(root, file))
    const src = readFileSync(file, "utf8")
    if (publicRoutes.has(rel)) continue
    if (!src.includes("handleProtectedMobileRoute")) {
      unguarded.push(rel)
    }
    assert.doesNotMatch(src, /denyIfPasswordChangeRequired/)
  }

  assert.deepEqual(unguarded, [])
})

test("hotfix 11. nota de compatibilidad explícita en el bearer gate", () => {
  const normalized = resolver.replace(/\s+/g, " ")
  assert.ok(
    normalized.includes(LEGACY_NOTE.replace(/\s+/g, " ")),
    "resolver must include the legacy Field Agent compatibility note"
  )
})
