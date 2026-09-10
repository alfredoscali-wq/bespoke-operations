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
const middleware = read("lib/mobile/v1/auth/mobile-bearer-middleware.ts")
const helpers = read("lib/mobile/v1/auth/mobile-auth-helpers.ts")
const handleRoute = read("lib/mobile/v1/handle-mobile-route.ts")
const loginService = read("lib/mobile/v1/auth/login-service.ts")
const loginMap = read("lib/mobile/v1/auth/map-mobile-user-response.ts")
const meRoute = read("app/api/mobile/v1/auth/me/route.ts")
const refreshService = read("lib/mobile/v1/auth/refresh-service.ts")
const refreshRoute = read("app/api/mobile/v1/auth/refresh/route.ts")
const changeRoute = read("app/api/mobile/v1/auth/change-password/route.ts")
const changeService = read("lib/mobile/v1/auth/change-password-service.ts")
const changeValidate = read("lib/mobile/v1/auth/validate-change-password-request.ts")
const mobileErrors = read("lib/mobile/v1/errors.ts")
const errorFactory = read("lib/mobile/v1/error-factory.ts")
const helperWeb = read("lib/auth/require-password-compliant-session.ts")
const networkAgent = read("lib/network/v1/agent-auth.ts")
const webGuardUi = read("components/auth/password-change-guard.tsx")
const resolverFn = sliceBetween(
  resolver,
  "export async function resolveMobileAuthFromAccessToken",
  ""
)

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

test("1. login must_change=false → user.mustChangePassword false", () => {
  const mapped = mapMobileLoginUser(
    { ...sessionFixture, mustChangePassword: false },
    { ...employeeFixture, mustChangePassword: false }
  )
  assert.equal(mapped.mustChangePassword, false)
  assert.match(loginService, /mapMobileLoginUser\(sessionUser, employee\)/)
  assert.doesNotMatch(loginService, /denyIfPasswordChangeRequired/)
})

test("2. login must_change=true → 200 path, flag true, tokens still issued", () => {
  const mapped = mapMobileLoginUser(sessionFixture, employeeFixture)
  assert.equal(mapped.mustChangePassword, true)
  assert.match(loginService, /accessToken: session\.access_token/)
  assert.match(loginService, /refreshToken: session\.refresh_token/)
  assert.doesNotMatch(loginService, /PASSWORD_CHANGE_REQUIRED/)
})

test("3. Bearer + must_change=true → 403 PASSWORD_CHANGE_REQUIRED", () => {
  assert.match(resolverFn, /denyIfPasswordChangeRequired\(sessionUser\)/)
  assert.match(resolverFn, /throw new MobileApiError\(denial\.code, denial\.message, denial\.status\)/)
  assert.match(mobileErrors, /"PASSWORD_CHANGE_REQUIRED"/)
  assert.match(read("lib/auth/require-password-compliant-session.ts"), /PASSWORD_CHANGE_REQUIRED_STATUS = 403/)
})

test("4. Bearer + must_change=false → gate continues to systemAccess", () => {
  const denyFn = sliceBetween(
    read("lib/auth/require-password-compliant-session.ts"),
    "export function denyIfPasswordChangeRequired",
    "export function passwordChangeRequiredResponse"
  )
  assert.match(denyFn, /if \(!sessionUser\.mustChangePassword\) \{\s*return null/)
  const passwordIdx = resolverFn.indexOf("denyIfPasswordChangeRequired")
  const disabledIdx = resolverFn.indexOf("assertEmployeeCanUseMobile")
  assert.ok(passwordIdx >= 0)
  assert.ok(passwordIdx < disabledIdx)
})

test("5. sin Bearer → 401, no PASSWORD_CHANGE_REQUIRED", () => {
  const missing = sliceBetween(
    middleware,
    'stage: "missing_bearer_token"',
    "resolveMobileAuthFromAccessToken"
  )
  assert.match(missing, /UNAUTHORIZED/)
  assert.match(missing, /,\s*401/)
  assert.doesNotMatch(missing, /PASSWORD_CHANGE_REQUIRED/)
})

test("6. employee inexistente conserva 404", () => {
  const missingEmployee = sliceBetween(
    resolverFn,
    "if (!employeeResult.data)",
    "const employee = employeeResult.data"
  )
  assert.match(missingEmployee, /EMPLOYEE_NOT_FOUND/)
  assert.match(missingEmployee, /404/)
  assert.doesNotMatch(missingEmployee, /PASSWORD_CHANGE_REQUIRED/)
  assert.ok(
    resolverFn.indexOf("EMPLOYEE_NOT_FOUND") <
      resolverFn.indexOf("denyIfPasswordChangeRequired")
  )
})

test("7. change-password con must_change=true está permitido", () => {
  assert.match(changeRoute, /allowPasswordChangeRequired: true/)
  assert.match(changeRoute, /changeMobilePassword/)
  assert.doesNotMatch(changeRoute, /denyIfPasswordChangeRequired/)
})

test("8. change-password no acepta employeeId del body", () => {
  const parsed = validateMobileChangePasswordRequest({
    newPassword: "abcdefgh",
    employeeId: "attacker-emp",
    appUserId: "attacker-auth",
    userId: "attacker-user",
  })
  assert.deepEqual(parsed, { newPassword: "abcdefgh" })
  assert.doesNotMatch(changeService, /record\.employeeId/)
  assert.doesNotMatch(changeService, /body\.employeeId/)
  assert.match(
    changeService,
    /patchEmployee\(admin, input\.auth\.employeeId/
  )
})

test("9. change-password usa exclusivamente identidad del token", () => {
  assert.match(changeService, /Authorization: `Bearer \$\{accessToken\}`/)
  assert.doesNotMatch(changeService, /updateUserById/)
  assert.doesNotMatch(changeService, /admin\.auth/)
  assert.match(changeRoute, /extractBearerToken\(request\)/)
  assert.match(changeRoute, /requireAuthenticatedUser\(context\)/)
})

test("10. después del cambio: flag false; siguiente API usa employee fresco", () => {
  assert.match(changeService, /mustChangePassword: false/)
  assert.match(resolver, /fetchEmployeeByAppUserId/)
  assert.match(
    resolverFn,
    /buildSessionUserFromAuthUser\(data\.user, employee\)/
  )
})

test("11. user_metadata no es autoridad del gate", () => {
  assert.doesNotMatch(resolverFn, /user_metadata/)
  assert.doesNotMatch(resolverFn, /must_change_password/)
  assert.match(resolverFn, /denyIfPasswordChangeRequired\(sessionUser\)/)
  assert.match(loginMap, /mustChangePassword: employee\.mustChangePassword/)
})

test("12. reset + token previo: siguiente request relee employee y aplica el gate", () => {
  assert.match(resolverFn, /fetchEmployeeByAppUserId/)
  assert.match(resolverFn, /denyIfPasswordChangeRequired\(sessionUser\)/)
  assert.doesNotMatch(read("lib/auth/reset-employee-password.ts"), /signOut/)
  assert.doesNotMatch(
    read("lib/auth/reset-employee-password.ts"),
    /revoke/
  )
})

test("13. refresh con must_change=true permitido", () => {
  assert.doesNotMatch(refreshService, /denyIfPasswordChangeRequired/)
  assert.doesNotMatch(refreshRoute, /denyIfPasswordChangeRequired/)
  assert.doesNotMatch(refreshRoute, /handleProtectedMobileRoute/)
  assert.match(refreshService, /refreshSession/)
})

test("14. login sigue permitido con must_change=true", () => {
  assert.doesNotMatch(loginService, /denyIfPasswordChangeRequired/)
  assert.match(read("app/api/mobile/v1/auth/login/route.ts"), /authenticateMobileLogin/)
})

test("15. devices/agenda/tasks/incidents bloqueados por gate común, sin guards por route", () => {
  const files = walkRouteFiles(join(root, "app", "api", "mobile", "v1"))
  const exempt = new Set([
    "app/api/mobile/v1/auth/login/route.ts",
    "app/api/mobile/v1/auth/refresh/route.ts",
    "app/api/mobile/v1/auth/me/route.ts",
    "app/api/mobile/v1/auth/change-password/route.ts",
  ])
  const duplicated = []
  const unguarded = []

  for (const file of files) {
    const rel = posix(relative(root, file))
    const src = readFileSync(file, "utf8")
    if (exempt.has(rel)) {
      assert.doesNotMatch(src, /denyIfPasswordChangeRequired/)
      continue
    }
    if (src.includes("denyIfPasswordChangeRequired")) {
      duplicated.push(rel)
    }
    if (!src.includes("handleProtectedMobileRoute")) {
      unguarded.push(rel)
    }
  }

  assert.deepEqual(duplicated, [])
  assert.deepEqual(unguarded, [])
  assert.match(resolver, /denyIfPasswordChangeRequired/)
  assert.match(handleRoute, /requireAuthenticatedMobileUser\(request, options\)/)
})

test("16. envelope Mobile correcto", () => {
  assert.match(errorFactory, /error: \{\s*code,\s*message,/)
  assert.match(mobileErrors, /"PASSWORD_CHANGE_REQUIRED"/)
  assert.doesNotMatch(resolver, /passwordChangeRequiredResponse/)
  assert.doesNotMatch(middleware, /passwordChangeRequiredResponse/)
})

test("17. denyIfPasswordChangeRequired reutilizado", () => {
  assert.match(
    resolver,
    /from "@\/lib\/auth\/require-password-compliant-session"/
  )
  assert.match(helperWeb, /export function denyIfPasswordChangeRequired/)
})

test("18. assertEmployeeCanUseMobile y 401 UNAUTHORIZED intactos", () => {
  assert.match(resolverFn, /assertEmployeeCanUseMobile\(employee\)/)
  assert.ok(
    resolverFn.indexOf("UNAUTHORIZED") <
      resolverFn.indexOf("EMPLOYEE_NOT_FOUND")
  )
  assert.match(middleware, /MOBILE_API_ERROR_MESSAGES\.UNAUTHORIZED/)
  const access = read("lib/mobile/v1/auth/assert-employee-mobile-access.ts")
  assert.match(access, /USER_DISABLED/)
  assert.doesNotMatch(access, /mustChangePassword/)
})

test("19. /auth/me expone mustChangePassword desde employee/session", () => {
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
  assert.match(meRoute, /allowPasswordChangeRequired: true/)
  assert.match(
    read("lib/mobile/v1/auth/mobile-auth-context.ts"),
    /mustChangePassword: sessionUser\.mustChangePassword/
  )
})

test("20. orden token → employee → password → systemAccess", () => {
  const tokenIdx = resolverFn.indexOf("auth.getUser(accessToken)")
  const employeeIdx = resolverFn.indexOf("fetchEmployeeByAppUserId")
  const passwordIdx = resolverFn.indexOf("denyIfPasswordChangeRequired")
  const disabledIdx = resolverFn.indexOf("assertEmployeeCanUseMobile")
  assert.ok(tokenIdx < employeeIdx)
  assert.ok(employeeIdx < passwordIdx)
  assert.ok(passwordIdx < disabledIdx)
})

test("21. network agent y PasswordChangeGuard Web no se tocan", () => {
  assert.doesNotMatch(networkAgent, /denyIfPasswordChangeRequired/)
  assert.doesNotMatch(networkAgent, /require-password-compliant-session/)
  assert.match(webGuardUi, /export function PasswordChangeGuard/)
  assert.doesNotMatch(
    read("lib/auth/require-password-compliant-session.ts"),
    /allowPasswordChangeRequired/
  )
})

test("22. validador de password: vacía / mínimo 8 / extra fields ignorados", () => {
  assert.throws(
    () => validateMobileChangePasswordRequest({ newPassword: "" }),
    /newPassword es obligatorio/
  )
  assert.throws(
    () => validateMobileChangePasswordRequest({ newPassword: "1234567" }),
    /al menos 8 caracteres/
  )
  const ok = validateMobileChangePasswordRequest({ newPassword: "12345678" })
  assert.equal(ok.newPassword, "12345678")
  assert.match(changeValidate, /MOBILE_CHANGE_PASSWORD_MIN_LENGTH = 8/)
})

test("23. Auth OK + employee patch fail no reporta éxito", () => {
  const changeFn = sliceBetween(
    changeService,
    "export async function changeMobilePassword",
    ""
  )
  assert.ok(
    changeFn.indexOf("updateAuthenticatedUserPassword") <
      changeFn.indexOf("patchEmployee")
  )
  assert.match(changeFn, /INTERNAL_ERROR/)
  assert.match(changeFn, /EMPLOYEE_SYNC_ERROR_MESSAGE/)
  assert.match(changeFn, /,\s*500/)
  assert.match(changeService, /no se pudo sincronizar el estado del empleado/)
  assert.match(changeFn, /return \{ ok: true \}/)
})
