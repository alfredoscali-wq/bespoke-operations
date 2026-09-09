import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
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

const resetService = read("lib/auth/reset-employee-password.ts")
const resetRoute = read("app/api/auth/reset-password/route.ts")
const resetClient = read("lib/auth/reset-password-client.ts")
const lookup = read("lib/auth/auth-user-lookup.ts")
const helper = read("lib/auth/temporary-password.ts")
const provider = read("components/rrhh/employees-provider.tsx")
const accessSection = read("components/rrhh/employee-system-access-section.tsx")
const contractors = read("components/contratistas/contractor-detail-page-client.tsx")
const passwordDialog = read("components/auth/temporary-password-dialog.tsx")
const auditServer = read("lib/audit/users-audit.server.ts")
const policy = read("lib/auth/initial-credentials-policy.ts")

const resetFn = sliceBetween(
  resetService,
  "export async function resetEmployeePassword",
  ""
)
const resolveFn = sliceBetween(
  lookup,
  "export async function resolveAuthUserById",
  ""
)
const resetAudit = sliceBetween(
  auditServer,
  "export async function recordUserPasswordResetAudit",
  "export async function recordUserRoleChangeAudit"
)

test("1. same-tenant reset usa generateTemporaryPassword en updateUserById", () => {
  assert.match(resetService, /from "@\/lib\/auth\/temporary-password"/)
  assert.match(resetFn, /const temporaryPassword = generateTemporaryPassword\(\)/)
  assert.match(
    resetFn,
    /updateUserById\(\s*authUserId,\s*\{\s*password: temporaryPassword/
  )
})

test("2. tenant gate ocurre antes de generate y de updateUserById", () => {
  const tenantIdx = resetFn.indexOf("resolveAdminEmployeeTenantAccess")
  const generateIdx = resetFn.indexOf("generateTemporaryPassword")
  const updateIdx = resetFn.indexOf("updateUserById")
  const resolveIdx = resetFn.indexOf("resolveAuthUserById")
  assert.ok(tenantIdx >= 0)
  assert.ok(tenantIdx < resolveIdx)
  assert.ok(resolveIdx < generateIdx)
  assert.ok(generateIdx < updateIdx)
})

test("3. no session → 401", () => {
  const sessionIdx = resetRoute.indexOf("getSessionUser()")
  const unauthorized = sliceBetween(
    resetRoute,
    "if (!sessionUser)",
    'systemRole !== "administrador"'
  )
  assert.ok(sessionIdx >= 0)
  assert.match(unauthorized, /status: 401/)
  assert.ok(sessionIdx < resetRoute.indexOf("resetEmployeePassword("))
})

test("4. non-admin → 403", () => {
  const roleBlock = sliceBetween(
    resetRoute,
    'systemRole !== "administrador"',
    "let body"
  )
  assert.match(roleBlock, /status: 403/)
})

test("5. missing company → 403", () => {
  const companyBlock = sliceBetween(
    resetRoute,
    "sessionUser.companyId",
    "resetEmployeePassword("
  )
  assert.match(companyBlock, /ADMIN_SESSION_COMPANY_UNAVAILABLE_ERROR/)
  assert.match(companyBlock, /status: 403/)
})

test("6. cross-tenant → 404 sin generate ni Auth mutation", () => {
  assert.match(resetFn, /resolveAdminEmployeeTenantAccess/)
  assert.match(resetFn, /ADMIN_EMPLOYEE_NOT_ACCESSIBLE_ERROR/)
  assert.match(resetRoute, /ADMIN_EMPLOYEE_NOT_ACCESSIBLE_STATUS/)
  const deny = sliceBetween(
    resetFn,
    "if (!tenantAccess.ok || !employeeResult.data)",
    "validateEmployeeForPasswordReset"
  )
  assert.doesNotMatch(deny, /generateTemporaryPassword/)
  assert.doesNotMatch(deny, /updateUserById/)
})

test("7. nonexistent → 404 sin mutation", () => {
  assert.match(
    resetFn,
    /employeeFound: Boolean\(employeeResult.data\) && !employeeResult.error/
  )
  assert.match(resetRoute, /ADMIN_EMPLOYEE_NOT_ACCESSIBLE_STATUS/)
})

test("8. employee sin appUserId → 422 sin generate ni mutation", () => {
  const validateFn = sliceBetween(
    resetService,
    "function validateEmployeeForPasswordReset",
    "export async function resetEmployeePassword"
  )
  assert.match(validateFn, /if \(!employee\.appUserId\)/)
  const generateIdx = resetFn.indexOf("generateTemporaryPassword")
  const validateCallIdx = resetFn.indexOf("validateEmployeeForPasswordReset")
  assert.ok(validateCallIdx < generateIdx)
  assert.match(resetRoute, /: 422/)
})

test("9. Auth user inexistente → 422 sin generate ni mutation", () => {
  assert.match(resetFn, /resolveAuthUserById/)
  assert.match(resetFn, /reason === "lookup_error"/)
  assert.match(resetFn, /AUTH_NOT_FOUND_ERROR/)
  const authCheck = sliceBetween(
    resetFn,
    "const authUser = await resolveAuthUserById",
    "generateTemporaryPassword"
  )
  assert.match(authCheck, /if \(!authUser\.ok\)/)
  assert.match(authCheck, /success: false/)
  assert.doesNotMatch(authCheck, /updateUserById/)
})

test("10. Auth lookup error fail-closed → 422 sin generate ni mutation", () => {
  assert.match(resolveFn, /reason: "lookup_error"/)
  assert.match(resolveFn, /if \(error\)/)
  assert.doesNotMatch(
    sliceBetween(resolveFn, 'if (error)', 'if (!data.user)'),
    /return \{ ok: true/
  )
  assert.match(resetFn, /AUTH_LOOKUP_ERROR/)
  const generateIdx = resetFn.indexOf("generateTemporaryPassword")
  const lookupReturnIdx = resetFn.indexOf("if (!authUser.ok)")
  assert.ok(lookupReturnIdx < generateIdx)
})

test("11. NO findAuthUserByDni fallback", () => {
  assert.doesNotMatch(resetService, /findAuthUserByDni/)
})

test("12. NO createUser", () => {
  assert.doesNotMatch(resetService, /createUser/)
  assert.doesNotMatch(resetRoute, /createUser/)
})

test("13. NO password normalizedDni en reset", () => {
  assert.doesNotMatch(resetService, /password: normalizedDni/)
  assert.doesNotMatch(resetFn, /password: employee/)
  assert.match(resetFn, /password: temporaryPassword/)
})

test("14. must_change_password=true", () => {
  assert.match(
    resetFn,
    /patchEmployee\(admin, trimmedId, \{\s*mustChangePassword: true/
  )
})

test("15. temporaryPassword solamente en success", () => {
  assert.match(
    resetFn,
    /return \{ success: true, temporaryPassword \}/
  )
  assert.match(
    resetRoute,
    /temporaryPassword: result\.temporaryPassword/
  )
  assert.match(resetClient, /temporaryPassword: data\.temporaryPassword/)
})

test("16. error responses no contienen temporaryPassword", () => {
  const failHttp = sliceBetween(
    resetRoute,
    "if (!result.success)",
    "const admin = createAdminClient()"
  )
  const catchHttp = resetRoute.slice(resetRoute.lastIndexOf("} catch {"))
  assert.doesNotMatch(failHttp, /temporaryPassword/)
  assert.doesNotMatch(catchHttp, /temporaryPassword/)
  assert.match(failHttp, /success: false, error: result\.error/)
  const falseReturns = [
    ...resetFn.matchAll(/success: false[\s\S]*?error:[^}]+/g),
  ].map((match) => match[0])
  assert.ok(falseReturns.length >= 4)
  for (const block of falseReturns) {
    assert.doesNotMatch(block, /temporaryPassword/)
  }
})

test("17. temporaryPassword no aparece en logs, Activity, metadata ni employee patch", () => {
  assert.doesNotMatch(resetService, /console\./)
  assert.doesNotMatch(resetRoute, /console\./)
  assert.doesNotMatch(resetAudit, /temporaryPassword/)
  assert.doesNotMatch(resetAudit, /password/)
  assert.doesNotMatch(resetAudit, /nationalId/)
  assert.match(
    resetFn,
    /patchEmployee\(admin, trimmedId, \{\s*mustChangePassword: true,\s*\}\)/
  )
  const auditCall = sliceBetween(
    resetRoute,
    "await recordUserPasswordResetAudit",
    "return NextResponse.json"
  )
  assert.doesNotMatch(auditCall, /temporaryPassword/)
})

test("18. UI reutiliza TemporaryPasswordDialog sin persistencia", () => {
  assert.match(accessSection, /TemporaryPasswordDialog/)
  assert.match(accessSection, /result\.temporaryPassword/)
  assert.match(contractors, /TemporaryPasswordDialog/)
  assert.doesNotMatch(accessSection, /localStorage/)
  assert.doesNotMatch(accessSection, /sessionStorage/)
  assert.doesNotMatch(accessSection, /document\.cookie/)
  assert.doesNotMatch(provider, /localStorage/)
  assert.doesNotMatch(resetClient, /localStorage/)
  assert.doesNotMatch(passwordDialog, /localStorage/)
  assert.doesNotMatch(accessSection, /console\.log/)
  assert.doesNotMatch(contractors, /console\.log/)
})

test("19. Provider no descarta el temporal si falla el refresh", () => {
  const resetProvider = sliceBetween(
    provider,
    "const resetEmployeePassword = useCallback",
    "const removeEmployee = useCallback"
  )
  assert.match(resetProvider, /const temporaryPassword = result\.temporaryPassword/)
  assert.match(
    resetProvider,
    /success: true,\s*message:[\s\S]*temporaryPassword \? \{ temporaryPassword \}/
  )
})

test("20. Contratistas no copy de password = DNI", () => {
  assert.doesNotMatch(contractors, /Restablecer al DNI/)
  assert.doesNotMatch(contractors, /restablecida al DNI/)
  assert.doesNotMatch(contractors, /contraseña temporal será el DNI/)
  assert.doesNotMatch(policy, /contraseña temporal será el DNI/)
  assert.doesNotMatch(policy, /restablecida al DNI/)
  assert.match(policy, /resetPassword: "temporary"/)
})

test("21. Generator usado desde temporary-password.ts, sin duplicar", () => {
  assert.match(resetService, /from "@\/lib\/auth\/temporary-password"/)
  assert.doesNotMatch(resetService, /TEMPORARY_PASSWORD_ALPHABET/)
  assert.doesNotMatch(resetService, /randomBytes/)
  assert.match(helper, /export function generateTemporaryPassword/)
})
