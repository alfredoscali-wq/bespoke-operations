import assert from "node:assert/strict"
import test from "node:test"

import {
  assertAuthEmailMatchesEmployeeDni,
  buildAuthEmail,
  buildAuthEmailCandidatesForDni,
  normalizeDni,
  parseDniFromAuthEmail,
} from "../lib/auth/auth-identity.ts"
import {
  BESPOKE_DEMO_COMPANY_ID,
  BESPOKE_PRODUCTION_COMPANY_ID,
} from "../lib/supabase/company.constants.ts"

test("auth email embeds DNI + company id (not bare DNI@domain)", () => {
  const email = buildAuthEmail("19.009.843", BESPOKE_PRODUCTION_COMPANY_ID)
  assert.equal(
    email,
    `19009843.${BESPOKE_PRODUCTION_COMPANY_ID}@auth.bespoke.local`
  )
  assert.notEqual(email, "19009843@auth.bespoke.local")
})

test("parseDniFromAuthEmail recovers DNI from company-suffixed email", () => {
  const email = `19009843.${BESPOKE_PRODUCTION_COMPANY_ID}@auth.bespoke.local`
  assert.equal(parseDniFromAuthEmail(email), "19009843")
})

test("login candidates include production and demo suffixes for same DNI", () => {
  const candidates = buildAuthEmailCandidatesForDni("19009843")
  assert.ok(
    candidates.includes(
      buildAuthEmail("19009843", BESPOKE_PRODUCTION_COMPANY_ID)
    )
  )
  assert.ok(
    candidates.includes(buildAuthEmail("19009843", BESPOKE_DEMO_COMPANY_ID))
  )
})

test("normalizeDni strips punctuation", () => {
  assert.equal(normalizeDni("19.009.843"), "19009843")
})

test("assertAuthEmailMatchesEmployeeDni accepts canonical synthetic email", () => {
  const expected = buildAuthEmail("19009843", BESPOKE_PRODUCTION_COMPANY_ID)
  const result = assertAuthEmailMatchesEmployeeDni({
    authEmail: expected,
    nationalId: "19.009.843",
    expectedAuthEmail: expected,
  })
  assert.equal(result.ok, true)
})
