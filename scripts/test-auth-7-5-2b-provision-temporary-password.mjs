import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  TEMPORARY_PASSWORD_ALPHABET,
  TEMPORARY_PASSWORD_LENGTH,
  generateTemporaryPassword,
} from "../lib/auth/temporary-password.ts"

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

const provisionService = read("lib/auth/auth-provisioning-service.ts")
const provisionRoute = read("app/api/auth/provision/route.ts")
const provisionClient = read("lib/auth/provision-client.ts")
const resetService = read("lib/auth/reset-employee-password.ts")
const employeesProvider = read("components/rrhh/employees-provider.tsx")
const accessSection = read("components/rrhh/employee-system-access-section.tsx")
const passwordDialog = read("components/auth/temporary-password-dialog.tsx")
const auditServer = read("lib/audit/users-audit.server.ts")
const helper = read("lib/auth/temporary-password.ts")

const provisionFn = sliceBetween(
  provisionService,
  "export async function provisionAuthIdentityForEmployee",
  "export async function provisionEmployeeAccess"
)
const createFn = sliceBetween(
  provisionService,
  "async function createAuthUserForEmployee",
  "export async function provisionAuthIdentityForEmployee"
)
const assignFn = sliceBetween(
  provisionService,
  "async function assignTemporaryPasswordToAuthUser",
  "async function createAuthUserForEmployee"
)
const linkFn = sliceBetween(
  provisionService,
  "async function linkEmployeeToAuthUser",
  "async function unbanAuthUserIfNeeded"
)
const caseB = sliceBetween(
  provisionFn,
  "Case B — already linked",
  "Case C — existing Auth"
)
const catchBlock = sliceBetween(provisionFn, "} catch (error) {", "")
const routeCatch = sliceBetween(provisionRoute, "catch (error)", "")
const failHttp = sliceBetween(
  provisionRoute,
  "if (!result.success)",
  "const admin = createAdminClient()"
)

test("1. create nuevo genera temporal", () => {
  assert.match(
    provisionService,
    /from "@\/lib\/auth\/temporary-password"/
  )
  assert.match(createFn, /const temporaryPassword = generateTemporaryPassword\(\)/)
  assert.match(createFn, /createUser\(\{\s*email,\s*password: temporaryPassword/)
})

test("2. create nuevo NO usa normalizedDni como password", () => {
  assert.doesNotMatch(createFn, /password: input\.normalizedDni/)
  assert.doesNotMatch(provisionService, /password: input\.normalizedDni/)
  assert.match(createFn, /national_id: input\.normalizedDni/)
  assert.match(resetService, /password: normalizedDni/)
})

test("3. create nuevo pone must_change=true", () => {
  assert.match(createFn, /must_change_password: true/)
  assert.match(linkFn, /mustChangePassword: true/)
})

test("4. response contiene temporaryPassword", () => {
  assert.match(provisionFn, /provisionSuccessWithTemporaryPassword/)
  assert.match(provisionRoute, /result\.temporaryPassword/)
  assert.match(provisionRoute, /payload\.temporaryPassword = result\.temporaryPassword/)
  assert.match(provisionClient, /temporaryPassword: data\.temporaryPassword/)
})

test("5. temporaryPassword cumple el generador", () => {
  const sample = generateTemporaryPassword()
  assert.equal(typeof sample, "string")
  assert.equal(sample.length, TEMPORARY_PASSWORD_LENGTH)
  for (const char of sample) {
    assert.equal(TEMPORARY_PASSWORD_ALPHABET.includes(char), true)
  }
  assert.match(createFn, /generateTemporaryPassword\(\)/)
  assert.match(assignFn, /generateTemporaryPassword\(\)/)
  assert.equal(helper.includes("Math.random"), false)
  assert.match(helper, /randomBytes\(/)
})

test("6. temporaryPassword no aparece en logs", () => {
  const logBodies = []
  const needle = "logProvision("
  let from = 0
  while (from < provisionService.length) {
    const start = provisionService.indexOf(needle, from)
    if (start < 0) break
    const prefix = provisionService.slice(Math.max(0, start - 20), start)
    const open = start + needle.length - 1
    let depth = 0
    let end = -1
    for (let i = open; i < provisionService.length; i += 1) {
      if (provisionService[i] === "(") depth += 1
      if (provisionService[i] === ")") {
        depth -= 1
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    from = end + 1
    if (prefix.includes("function ")) continue
    logBodies.push(provisionService.slice(start, end + 1))
  }
  const joined = logBodies.join("\n")
  assert.doesNotMatch(joined, /temporaryPassword/)
  assert.doesNotMatch(joined, /issuedTemporaryPassword/)
  assert.doesNotMatch(joined, /\bpassword\s*:/)
  assert.doesNotMatch(joined, /normalizedDni/)
  assert.doesNotMatch(joined, /\bemail\s*:/)
  assert.doesNotMatch(joined, /authEmail/)
})

test("7. temporaryPassword no aparece en Activity", () => {
  const createAudit = sliceBetween(
    auditServer,
    "export async function recordUserCreateAudit",
    "export async function recordUserProvisionAudit"
  )
  const provisionAudit = sliceBetween(
    auditServer,
    "export async function recordUserProvisionAudit",
    "export async function recordUserPasswordResetAudit"
  )
  assert.doesNotMatch(createAudit, /temporaryPassword/)
  assert.doesNotMatch(createAudit, /password/)
  assert.doesNotMatch(provisionAudit, /temporaryPassword/)
  assert.doesNotMatch(provisionAudit, /password/)
  const employeeAudit = sliceBetween(
    provisionRoute,
    "if (employee) {",
    "const payload:"
  )
  assert.doesNotMatch(employeeAudit, /temporaryPassword/)
  assert.doesNotMatch(employeeAudit, /password/)
})

test("8. temporaryPassword no se persiste en employees", () => {
  assert.doesNotMatch(linkFn, /password/)
  assert.doesNotMatch(linkFn, /temporaryPassword/)
  assert.match(
    linkFn,
    /patchEmployee\(admin, employeeId, \{\s*appUserId: authUserId,\s*mustChangePassword: true,\s*systemAccess: true,/
  )
  assert.doesNotMatch(provisionService, /localStorage/)
  assert.doesNotMatch(employeesProvider, /localStorage/)
  assert.doesNotMatch(accessSection, /localStorage/)
  assert.doesNotMatch(passwordDialog, /localStorage/)
})

test("9. Auth ya vinculado NO rota password", () => {
  assert.doesNotMatch(caseB, /generateTemporaryPassword/)
  assert.doesNotMatch(caseB, /assignTemporaryPasswordToAuthUser/)
  assert.doesNotMatch(caseB, /createAuthUserForEmployee/)
  assert.doesNotMatch(caseB, /password:/)
  assert.match(caseB, /provisionSuccessWithoutSecret/)
})

test("10. Auth ya vinculado NO devuelve temporaryPassword", () => {
  const withoutSecret = sliceBetween(
    provisionService,
    "function provisionSuccessWithoutSecret",
    "function provisionSuccessWithTemporaryPassword"
  )
  assert.doesNotMatch(withoutSecret, /temporaryPassword/)
  assert.match(withoutSecret, /reused: true/)
  assert.match(withoutSecret, /created: false/)
  assert.match(caseB, /return provisionSuccessWithoutSecret\(linked\.id\)/)
})

test("11. Auth sin app_user_id rota con nuevo temporal", () => {
  assert.match(
    provisionFn,
    /Reusing existing Auth identity; rotating secret/
  )
  assert.match(assignFn, /generateTemporaryPassword\(\)/)
  assert.match(
    assignFn,
    /updateUserById\(authUserId, \{\s*password: temporaryPassword/
  )
  assert.match(
    provisionFn,
    /issuedTemporaryPassword = await assignTemporaryPasswordToAuthUser/
  )
})

test("12. Auth sin app_user_id devuelve el nuevo temporal", () => {
  assert.match(provisionFn, /provisionSuccessWithTemporaryPassword/)
  assert.match(
    provisionFn,
    /temporaryPassword: issuedTemporaryPassword/
  )
  const withSecret = sliceBetween(
    provisionService,
    "function provisionSuccessWithTemporaryPassword",
    "function logProvision"
  )
  assert.match(withSecret, /reused: false/)
  assert.match(withSecret, /temporaryPassword: input\.temporaryPassword/)
})

test("13. retry después de create/link failure genera nuevo temporal", () => {
  assert.match(createFn, /return \{ user: recovered, created: false \}/)
  assert.doesNotMatch(
    sliceBetween(createFn, "if (recovered)", "throw new Error(error.message)"),
    /temporaryPassword/
  )
  assert.match(
    provisionFn,
    /if \(createdResult\.created\) \{\s*issuedTemporaryPassword = createdResult\.temporaryPassword\s*\} else \{/
  )
  assert.match(
    provisionFn,
    /issuedTemporaryPassword = await assignTemporaryPasswordToAuthUser/
  )
  const linkIdx = provisionFn.indexOf("await linkEmployeeToAuthUser")
  const returnIdx = provisionFn.indexOf("provisionSuccessWithTemporaryPassword")
  assert.ok(linkIdx >= 0 && returnIdx > linkIdx)
})

test("14. password temporal anterior nunca se reutiliza", () => {
  assert.match(createFn, /caller must rotate \(Case C\)/)
  assert.doesNotMatch(provisionService, /previousPassword/)
  assert.doesNotMatch(provisionService, /lastTemporary/)
  assert.doesNotMatch(provisionService, /from\("temporary/)
  assert.doesNotMatch(resetService, /generateTemporaryPassword/)
})

test("15. error final NO devuelve password", () => {
  assert.match(catchBlock, /return \{ success: false, error: message \}/)
  assert.doesNotMatch(catchBlock, /temporaryPassword/)
  assert.doesNotMatch(failHttp, /temporaryPassword/)
  assert.doesNotMatch(routeCatch, /temporaryPassword/)
  assert.match(provisionClient, /success: false,\s*error:/)
})

test("16. body company_id no puede modificar tenant isolation", () => {
  assert.match(provisionRoute, /employeeId\?: string/)
  assert.doesNotMatch(provisionRoute, /company_id/)
  assert.match(
    provisionRoute,
    /provisionAuthIdentityForEmployee\(\s*employeeId,\s*sessionCompanyId\s*\)/
  )
})

test("17. cross-tenant sigue bloqueado por 7.2", () => {
  const tenantIdx = provisionFn.indexOf("resolveAdminEmployeeTenantAccess")
  const generateIdx = provisionFn.indexOf("assignTemporaryPasswordToAuthUser")
  const createIdx = provisionFn.indexOf("createAuthUserForEmployee")
  const linkIdx = provisionFn.indexOf("linkEmployeeToAuthUser")
  assert.ok(tenantIdx >= 0)
  assert.ok(tenantIdx < generateIdx)
  assert.ok(tenantIdx < createIdx)
  assert.ok(tenantIdx < linkIdx)
  assert.ok(tenantIdx < provisionFn.indexOf("if (!employee.systemAccess)"))
})

test("18. must_change=true solo en los casos que reciben temporal", () => {
  assert.doesNotMatch(caseB, /mustChangePassword/)
  assert.doesNotMatch(caseB, /must_change_password/)
  assert.match(createFn, /must_change_password: true/)
  assert.match(linkFn, /mustChangePassword: true/)
  assert.doesNotMatch(assignFn, /must_change_password/)
  const caseBReturnIdx = caseB.indexOf("provisionSuccessWithoutSecret")
  const linkCallIdx = provisionFn.indexOf("await linkEmployeeToAuthUser")
  assert.ok(caseBReturnIdx >= 0)
  assert.ok(linkCallIdx > provisionFn.indexOf("Case C — existing Auth"))
})

test("UI muestra el temporal one-shot y omite copy DNI como password", () => {
  assert.match(accessSection, /TemporaryPasswordDialog/)
  assert.match(accessSection, /result\.temporaryPassword/)
  assert.match(
    accessSection,
    /setProvisionSuccess\("Acceso provisionado correctamente\."\)/
  )
  assert.doesNotMatch(accessSection, /contraseña inicial = DNI/)
  assert.doesNotMatch(employeesProvider, /localStorage/)
  assert.match(passwordDialog, /navigator\.clipboard\.writeText\(reveal\.password\)/)
  assert.match(passwordDialog, /buildTemporaryPasswordDeliveryMessage/)
})

test("reset no fue modificado por 7.5.2B", () => {
  assert.doesNotMatch(resetService, /generateTemporaryPassword/)
  assert.match(resetService, /password: normalizedDni/)
})
