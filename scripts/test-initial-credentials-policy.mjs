import assert from "node:assert/strict"
import test from "node:test"

import {
  buildInitialCredentialsInfoMessage,
  buildPasswordResetToDniFeedback,
  buildProvisionedCredentialsFeedback,
  buildResetPasswordToDniDescription,
  INITIAL_CREDENTIALS_POLICY,
  resolveInitialPasswordFromDni,
} from "../lib/auth/initial-credentials-policy.ts"

test("política fija usuario DNI y contraseña temporal en alta", () => {
  assert.equal(INITIAL_CREDENTIALS_POLICY.loginIdentifier, "DNI")
  assert.equal(INITIAL_CREDENTIALS_POLICY.initialPassword, "temporary")
  assert.equal(INITIAL_CREDENTIALS_POLICY.requireChangeOnFirstLogin, true)
})

test("resolveInitialPasswordFromDni normaliza dígitos", () => {
  assert.equal(resolveInitialPasswordFromDni("12.345.678"), "12345678")
  assert.equal(resolveInitialPasswordFromDni("abc"), null)
})

test("mensajes de alta ya no dicen contraseña = DNI; reset sí (7.5.2C)", () => {
  const info = buildInitialCredentialsInfoMessage("30.112.233")
  assert.match(info, /usuario = DNI/)
  assert.match(info, /30112233/)
  assert.doesNotMatch(info, /contraseña = DNI/)
  assert.match(info, /temporal/)
  assert.match(info, /primer inicio/)

  const reset = buildResetPasswordToDniDescription("30112233")
  assert.match(reset, /30112233/)
  assert.match(reset, /cambiarla/)

  const provisioned = buildProvisionedCredentialsFeedback("Juan Pérez")
  assert.match(provisioned, /Juan Pérez/)
  assert.doesNotMatch(provisioned, /contraseña inicial = DNI/)
  assert.match(buildPasswordResetToDniFeedback("Ana"), /Ana/)
})
