/**
 * Sprint Tesorería 2.2A — only show "Medio Modificado" when received ≠ expected.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { resolveOtRenditionPaymentMatch } from "../lib/tesoreria/ot-rendition-payment.ts"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

test("badge UI hides Coincide and only renders Medio Modificado", () => {
  const badge = read("components/tesoreria/treasury-payment-match-badge.tsx")
  assert.doesNotMatch(badge, /✓ Coincide/)
  assert.match(badge, /⚠ Medio Modificado/)
  assert.match(badge, /match !== "modified"/)
  assert.match(badge, /Esperado:/)
  assert.match(badge, /Cobrado:/)
  assert.match(badge, /Tooltip/)
})

test("match helper still distinguishes equal vs modified", () => {
  assert.equal(
    resolveOtRenditionPaymentMatch("efectivo", "efectivo"),
    "match"
  )
  assert.equal(
    resolveOtRenditionPaymentMatch("efectivo", "transferencia"),
    "modified"
  )
})

test("historial shows received method and optional modified badge only", () => {
  const history = read("components/tesoreria/treasury-movements-history.tsx")
  assert.match(history, /formatTreasuryPaymentMethodLabel/)
  assert.match(history, /renditionPayment\.received/)
  assert.match(history, /TreasuryPaymentMatchBadge/)
  assert.doesNotMatch(history, /✓ Coincide/)
})
