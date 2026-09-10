import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import test from "node:test"

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

const helper = read("lib/auth/require-password-compliant-session.ts")
const requireAdmin = read("lib/auth/require-administrator.ts")
const requireWritable = read("lib/auth/require-writable-platform-session.ts")
const authProvider = read("components/auth/auth-provider.tsx")
const guardUi = read("components/auth/password-change-guard.tsx")
const changePassword = read("lib/auth/change-password.ts")
const changeForm = read("components/auth/change-password-form.tsx")
const loginForm = read("components/auth/login-form.tsx")
const routes = read("lib/auth/routes.ts")
const health = read("app/api/health/supabase/route.ts")
const cron = read("app/api/cron/weekly-report/route.ts")
const auditSession = read("app/api/auth/audit-session/route.ts")
const syncMine = read("app/api/auth/sync-my-metadata/route.ts")
const provisionRoute = read("app/api/auth/provision/route.ts")
const resetRoute = read("app/api/auth/reset-password/route.ts")
const ispContext = read("lib/isp/route-context.ts")
const incidentsGet = read("app/api/operations/incidents/route.ts")
const incidentsId = read("app/api/operations/incidents/[incidentId]/route.ts")
const attachmentsId = read("app/api/attachments/[id]/route.ts")
const mobileHelper = read("lib/mobile/v1/auth/mobile-auth-helpers.ts")
const networkAgent = read("lib/network/v1/agent-auth.ts")
const resolveSession = read("lib/auth/resolve-session-user.ts")

const denyFn = sliceBetween(
  helper,
  "export function denyIfPasswordChangeRequired",
  "export function passwordChangeRequiredResponse"
)
const loadedFn = sliceBetween(
  helper,
  "export function requireLoadedPasswordCompliantSession",
  ""
)
const adminFn = sliceBetween(
  requireAdmin,
  "export async function requireAdministratorSession",
  ""
)
const writableFn = sliceBetween(
  requireWritable,
  "export async function requireWritablePlatformSession",
  ""
)
const redirectFn = sliceBetween(
  authProvider,
  "export function redirectAfterSignIn",
  ""
)

test("1. must_change=false → allow", () => {
  assert.match(denyFn, /if \(!sessionUser\.mustChangePassword\) \{\s*return null/)
})

test("2. must_change=true → 403", () => {
  assert.match(denyFn, /status: PASSWORD_CHANGE_REQUIRED_STATUS/)
  assert.match(helper, /PASSWORD_CHANGE_REQUIRED_STATUS = 403/)
})

test("3. error code = PASSWORD_CHANGE_REQUIRED", () => {
  assert.match(helper, /PASSWORD_CHANGE_REQUIRED_CODE = "PASSWORD_CHANGE_REQUIRED"/)
  assert.match(denyFn, /code: PASSWORD_CHANGE_REQUIRED_CODE/)
  assert.match(helper, /code: PASSWORD_CHANGE_REQUIRED_CODE/)
})

test("4. no session → sigue siendo 401", () => {
  assert.match(adminFn, /if \(!sessionUser\)/)
  assert.match(adminFn, /status: 401/)
  const unauth = sliceBetween(adminFn, "if (!sessionUser)", "denyIfPasswordChangeRequired")
  assert.doesNotMatch(unauth, /PASSWORD_CHANGE_REQUIRED/)
  assert.match(loadedFn, /status: 401/)
  const loadedNull = sliceBetween(loadedFn, "if (!sessionUser)", "denyIfPasswordChangeRequired")
  assert.doesNotMatch(loadedNull, /PASSWORD_CHANGE_REQUIRED/)
})

test("5. /cambiar-contrasena permitido", () => {
  assert.match(routes, /CHANGE_PASSWORD_PATH = "\/cambiar-contrasena"/)
  assert.match(guardUi, /isPasswordChangeGuardAllowedPath/)
  assert.doesNotMatch(changeForm, /denyIfPasswordChangeRequired/)
  assert.doesNotMatch(changePassword, /denyIfPasswordChangeRequired/)
})

test("6. login permitido", () => {
  assert.match(loginForm, /signIn\(/)
  assert.doesNotMatch(loginForm, /denyIfPasswordChangeRequired/)
})

test("7. change-password permitido", () => {
  assert.match(changePassword, /supabase\.auth\.updateUser\(\{\s*password: params\.newPassword/)
  assert.match(changePassword, /mustChangePassword: false/)
  assert.doesNotMatch(changePassword, /app\/api/)
})

test("8. logout permitido", () => {
  assert.doesNotMatch(auditSession, /denyIfPasswordChangeRequired/)
  assert.doesNotMatch(auditSession, /requireAdministratorSession/)
  assert.match(authProvider, /supabase\.auth\.signOut\(\)/)
})

test("9. health permitido", () => {
  assert.doesNotMatch(health, /getSessionUser/)
  assert.doesNotMatch(health, /denyIfPasswordChangeRequired/)
})

test("10. cron permitido por su propio mecanismo", () => {
  assert.match(cron, /isAuthorized\(request\)/)
  assert.doesNotMatch(cron, /denyIfPasswordChangeRequired/)
  assert.doesNotMatch(cron, /getSessionUser/)
})

test("11. GET API protegida bloqueada", () => {
  assert.match(ispContext, /requireIspReadContext/)
  assert.match(ispContext, /requireLoadedPasswordCompliantSession/)
  assert.match(incidentsGet, /export async function GET/)
  assert.match(incidentsGet, /denyIfPasswordChangeRequired/)
})

test("12. POST API protegida bloqueada", () => {
  const post = sliceBetween(provisionRoute, "export async function POST", "")
  assert.match(post, /denyIfPasswordChangeRequired/)
  assert.match(resetRoute, /denyIfPasswordChangeRequired/)
  assert.ok(
    post.indexOf("denyIfPasswordChangeRequired") <
      post.indexOf("provisionAuthIdentityForEmployee")
  )
})

test("13. PATCH API protegida bloqueada", () => {
  assert.match(incidentsId, /export async function PATCH/)
  assert.match(incidentsId, /requireWritablePlatformSession/)
  assert.match(writableFn, /denyIfPasswordChangeRequired/)
})

test("14. DELETE API protegida bloqueada", () => {
  assert.match(attachmentsId, /requireWritablePlatformSession/)
  assert.match(writableFn, /denyIfPasswordChangeRequired/)
})

test("15. administrador + must_change=true bloqueado", () => {
  const passwordIdx = adminFn.indexOf("denyIfPasswordChangeRequired")
  const roleIdx = adminFn.indexOf('systemRole !== "administrador"')
  assert.ok(passwordIdx >= 0)
  assert.ok(passwordIdx < roleIdx)
  assert.match(provisionRoute, /denyIfPasswordChangeRequired/)
  assert.match(resetRoute, /denyIfPasswordChangeRequired/)
})

test("16. employee normal + false sin cambios", () => {
  assert.match(denyFn, /if \(!sessionUser\.mustChangePassword\) \{\s*return null/)
  assert.match(writableFn, /isDemoPlatformReadOnlyUser/)
})

test("17. guard no usa user_metadata como autoridad", () => {
  assert.doesNotMatch(denyFn, /user_metadata/)
  assert.doesNotMatch(denyFn, /metadata/)
  assert.match(denyFn, /sessionUser\.mustChangePassword/)
  assert.match(resolveSession, /mustChangePassword: employee\.mustChangePassword/)
})

test("18. getSessionUser null no se convierte en password-required", () => {
  assert.match(
    loadedFn,
    /if \(!sessionUser\) \{[\s\S]*status: 401[\s\S]*denyIfPasswordChangeRequired/
  )
  assert.match(
    adminFn,
    /if \(!sessionUser\) \{[\s\S]*status: 401[\s\S]*denyIfPasswordChangeRequired/
  )
})

test("19. redirectAfterSignIn manda a /cambiar-contrasena", () => {
  assert.match(redirectFn, /if \(sessionUser\.mustChangePassword\)/)
  assert.match(redirectFn, /CHANGE_PASSWORD_PATH/)
  assert.ok(
    redirectFn.indexOf("mustChangePassword") <
      redirectFn.indexOf("sanitizeRedirectPath")
  )
})

test("20. PasswordChangeGuard permanece", () => {
  assert.match(guardUi, /export function PasswordChangeGuard/)
  assert.match(guardUi, /sessionUser\.mustChangePassword/)
  assert.match(read("app/layout.tsx"), /<PasswordChangeGuard \/>/)
})

test("21. mobile/network no reciben este guard accidentalmente", () => {
  assert.doesNotMatch(mobileHelper, /denyIfPasswordChangeRequired/)
  assert.doesNotMatch(networkAgent, /denyIfPasswordChangeRequired/)
  assert.doesNotMatch(networkAgent, /require-password-compliant-session/)
})

test("22. provisioning/reset no quedan accidentalmente exentos", () => {
  assert.match(provisionRoute, /denyIfPasswordChangeRequired/)
  assert.match(resetRoute, /denyIfPasswordChangeRequired/)
  assert.ok(
    resetRoute.indexOf("denyIfPasswordChangeRequired") <
      resetRoute.indexOf("resetEmployeePassword(")
  )
})

test("23. temporaryPassword nunca aparece en el error", () => {
  assert.doesNotMatch(helper, /temporaryPassword/)
  assert.doesNotMatch(denyFn, /password:/)
})

test("24. DNI nunca aparece como password", () => {
  assert.doesNotMatch(helper, /normalizedDni/)
  assert.doesNotMatch(helper, /nationalId/)
  assert.doesNotMatch(helper, /DNI/)
})

test("shared helpers cubren require* web", () => {
  assert.match(requireAdmin, /from "@\/lib\/auth\/require-password-compliant-session"/)
  assert.match(requireWritable, /from "@\/lib\/auth\/require-password-compliant-session"/)
  assert.match(ispContext, /requireLoadedPasswordCompliantSession/)
  assert.match(read("lib/materials/route-context.ts"), /requireLoadedPasswordCompliantSession/)
  assert.match(read("lib/commercial/route-context.ts"), /requireLoadedPasswordCompliantSession/)
  assert.match(read("lib/network/route-context.ts"), /requireLoadedPasswordCompliantSession/)
  assert.match(read("lib/subscriptions/route-context.ts"), /requireLoadedPasswordCompliantSession/)
  assert.match(
    read("lib/customer-atenciones/action-auth.server.ts"),
    /denyIfPasswordChangeRequired/
  )
  assert.match(
    read("lib/customer-atenciones/release-expired-auth.server.ts"),
    /denyIfPasswordChangeRequired/
  )
})

test("bootstrap endpoints exentos: audit-session y sync-my-metadata", () => {
  assert.doesNotMatch(auditSession, /denyIfPasswordChangeRequired/)
  assert.doesNotMatch(syncMine, /denyIfPasswordChangeRequired/)
  assert.match(syncMine, /getSessionUserWithAuthSyncContext/)
})

test("coverage: APIs web de negocio pasan por el guard; E vacío", () => {
  const files = walkRouteFiles(join(root, "app", "api"))
  const guarded =
    /requireAdministratorSession|requireWritablePlatformSession|requireLoadedPasswordCompliantSession|denyIfPasswordChangeRequired|requireIsp|requireMaterials|requireGestionComercial|requireNetworkReadContext|requireNetworkWriteContext|requireSubscriptions|requireTaskMaterialLines|requireAtencionCliente|requireCustomerActionAuthContext|requireReleaseExpiredAuthContext/

  const counts = { A: 0, C: 0, D: 0, E: [] }

  for (const file of files) {
    const rel = posix(relative(root, file))
    const src = readFileSync(file, "utf8")
    if (rel.includes("/api/mobile/") || rel.includes("/api/network/v1/")) {
      counts.D += 1
      continue
    }
    if (rel.includes("/api/health/") || rel.includes("/api/cron/")) {
      counts.D += 1
      continue
    }
    if (
      rel.endsWith("/api/auth/audit-session/route.ts") ||
      rel.endsWith("/api/auth/sync-my-metadata/route.ts")
    ) {
      counts.C += 1
      continue
    }
    if (guarded.test(src)) {
      counts.A += 1
      continue
    }
    counts.E.push(rel)
  }

  assert.equal(counts.E.length, 0, `ungarded business APIs: ${counts.E.join(", ")}`)
  assert.ok(counts.A >= 140, `expected broad web coverage, got A=${counts.A}`)
  assert.equal(counts.C, 2)
  assert.ok(counts.D >= 20)
})
