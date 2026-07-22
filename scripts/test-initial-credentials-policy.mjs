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

test("política fija usuario y contraseña inicial en DNI", () => {
  assert.equal(INITIAL_CREDENTIALS_POLICY.loginIdentifier, "DNI")
  assert.equal(INITIAL_CREDENTIALS_POLICY.initialPassword, "DNI")
  assert.equal(INITIAL_CREDENTIALS_POLICY.requireChangeOnFirstLogin, true)
})

test("resolveInitialPasswordFromDni normaliza dígitos", () => {
  assert.equal(resolveInitialPasswordFromDni("12.345.678"), "12345678")
  assert.equal(resolveInitialPasswordFromDni("abc"), null)
})

test("mensajes de alta y reset mencionan DNI y cambio obligatorio", () => {
  const info = buildInitialCredentialsInfoMessage("30.112.233")
  assert.match(info, /usuario = DNI/)
  assert.match(info, /30112233/)
  assert.match(info, /contraseña = DNI/)
  assert.match(info, /primer inicio/)

  const reset = buildResetPasswordToDniDescription("30112233")
  assert.match(reset, /30112233/)
  assert.match(reset, /cambiarla/)

  assert.match(
    buildProvisionedCredentialsFeedback("Juan Pérez"),
    /Juan Pérez/
  )
  assert.match(buildPasswordResetToDniFeedback("Ana"), /Ana/)
})
