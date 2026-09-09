import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

function extractLogProvisionCalls(source) {
  const calls = []
  const needle = "logProvision("
  let from = 0

  while (from < source.length) {
    const start = source.indexOf(needle, from)
    if (start < 0) break

    const open = start + needle.length - 1
    let depth = 0
    let end = -1
    for (let i = open; i < source.length; i += 1) {
      const ch = source[i]
      if (ch === "(") depth += 1
      if (ch === ")") {
        depth -= 1
        if (depth === 0) {
          end = i
          break
        }
      }
    }

    if (end < 0) break
    const prefix = source.slice(Math.max(0, start - 20), start)
    const call = source.slice(start, end + 1)
    from = end + 1
    if (prefix.includes("function ")) continue
    calls.push(call)
  }

  return calls
}

const provisionService = read("lib/auth/auth-provisioning-service.ts")
const provisionRoute = read("app/api/auth/provision/route.ts")
const resetService = read("lib/auth/reset-employee-password.ts")
const resetRoute = read("app/api/auth/reset-password/route.ts")
const resetAudit = read("lib/audit/users-audit.server.ts")
const logCalls = extractLogProvisionCalls(provisionService)
const logPayloads = logCalls.join("\n")

test("provisioning emite logs operacionales", () => {
  assert.ok(logCalls.length >= 8)
  assert.match(logPayloads, /employeeId/)
  assert.match(logPayloads, /Provision complete/)
})

test("provisioning no loguea DNI, password ni secretos derivados", () => {
  assert.doesNotMatch(logPayloads, /\bdni\s*:/)
  assert.doesNotMatch(logPayloads, /targetDni/)
  assert.doesNotMatch(logPayloads, /otherDni/)
  assert.doesNotMatch(logPayloads, /\bpassword\s*:/)
  assert.doesNotMatch(logPayloads, /normalizedDni/)
  assert.doesNotMatch(logPayloads, /authEmail/)
  assert.doesNotMatch(logPayloads, /\bemail\s*:/)
  assert.doesNotMatch(logPayloads, /national_id/)
  assert.doesNotMatch(logPayloads, /initial password/i)
  assert.doesNotMatch(logPayloads, /temporary password/i)
  assert.doesNotMatch(logPayloads, /contraseña/i)
})

test("createUser sigue usando DNI como password (modelo intacto) fuera de logs", () => {
  assert.match(
    provisionService,
    /createUser\(\{\s*email,\s*password: input\.normalizedDni/
  )
  assert.match(provisionService, /national_id: input\.normalizedDni/)
})

test("ruta de provision no devuelve password", () => {
  assert.match(provisionRoute, /authUserId: result\.authUserId/)
  assert.match(provisionRoute, /reused: result\.reused/)
  assert.match(provisionRoute, /created: result\.created/)
  assert.doesNotMatch(provisionRoute, /password/)
  assert.doesNotMatch(provisionRoute, /normalizedDni/)
})

test("reset no loguea ni responde password/DNI", () => {
  assert.doesNotMatch(resetService, /console\./)
  assert.doesNotMatch(resetRoute, /console\./)
  assert.match(resetRoute, /return NextResponse\.json\(result, \{ status: 200 \}\)/)
  assert.doesNotMatch(resetRoute, /password:/)
  assert.doesNotMatch(resetRoute, /normalizedDni/)
  const auditFn = resetAudit.slice(
    resetAudit.indexOf("export async function recordUserPasswordResetAudit"),
    resetAudit.indexOf("export async function recordUserRoleChangeAudit")
  )
  assert.doesNotMatch(auditFn, /password/)
  assert.doesNotMatch(auditFn, /nationalId/)
  assert.doesNotMatch(auditFn, /\bdni\b/i)
})
