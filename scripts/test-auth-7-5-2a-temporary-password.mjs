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
const helperSource = readFileSync(
  resolve(root, "lib/auth/temporary-password.ts"),
  "utf8"
)
const knownDni = "19009843"
const allowed = new Set(TEMPORARY_PASSWORD_ALPHABET.split(""))

test("1. generateTemporaryPassword retorna string", () => {
  assert.equal(typeof generateTemporaryPassword(), "string")
})

test("2. longitud >= 16", () => {
  assert.equal(TEMPORARY_PASSWORD_LENGTH, 16)
  const value = generateTemporaryPassword()
  assert.ok(value.length >= 16)
  assert.equal(value.length, TEMPORARY_PASSWORD_LENGTH)
})

test("3. múltiples llamadas producen valores diferentes", () => {
  const samples = new Set(
    Array.from({ length: 20 }, () => generateTemporaryPassword())
  )
  assert.equal(samples.size, 20)
})

test("4. no contiene DNI conocido", () => {
  for (let i = 0; i < 20; i += 1) {
    const value = generateTemporaryPassword()
    assert.notEqual(value, knownDni)
    assert.equal(value.includes(knownDni), false)
  }
  assert.equal(TEMPORARY_PASSWORD_ALPHABET.includes("0"), false)
  assert.equal(TEMPORARY_PASSWORD_ALPHABET.includes("1"), false)
})

test("5. no recibe ni incrusta contexto de empleado", () => {
  assert.match(helperSource, /export function generateTemporaryPassword\(\): string/)
  assert.doesNotMatch(helperSource, /employeeId/)
  assert.doesNotMatch(helperSource, /companyId/)
  assert.doesNotMatch(helperSource, /nationalId/)
  assert.doesNotMatch(helperSource, /normalizeDni/)
})

test("6. solo contiene caracteres permitidos", () => {
  const value = generateTemporaryPassword()
  for (const char of value) {
    assert.equal(allowed.has(char), true, `carácter no permitido: ${char}`)
  }
  assert.doesNotMatch(value, /[0OolI1i]/)
})

test("7. no usa Math.random", () => {
  assert.doesNotMatch(helperSource, /Math\.random/)
})

test("8. usa crypto.randomBytes", () => {
  assert.match(helperSource, /from "node:crypto"/)
  assert.match(helperSource, /randomBytes\(/)
  assert.doesNotMatch(helperSource, /randomUUID/)
})

test("9. helper no tiene side effects de DB/Auth/logging", () => {
  assert.doesNotMatch(helperSource, /createAdminClient/)
  assert.doesNotMatch(helperSource, /supabase/i)
  assert.doesNotMatch(helperSource, /console\./)
  assert.doesNotMatch(helperSource, /fetchEmployee/)
  assert.doesNotMatch(helperSource, /createUser/)
  assert.doesNotMatch(helperSource, /updateUserById/)
  assert.doesNotMatch(helperSource, /NETWORK_/)
})

test("provisioning y reset aún no importan el helper", () => {
  const provision = readFileSync(
    resolve(root, "lib/auth/auth-provisioning-service.ts"),
    "utf8"
  )
  const reset = readFileSync(
    resolve(root, "lib/auth/reset-employee-password.ts"),
    "utf8"
  )
  assert.doesNotMatch(provision, /generateTemporaryPassword/)
  assert.doesNotMatch(reset, /generateTemporaryPassword/)
  assert.match(provision, /password: input\.normalizedDni/)
})
