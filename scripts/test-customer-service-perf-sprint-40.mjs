/**
 * Sprint 40.0 — Parallelize independent awaits (defer / resolve / derive).
 */
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()

const DEFER_ROUTE =
  "app/api/atencion-cliente/[atencionId]/defer/route.ts"
const RESOLVE_ROUTE =
  "app/api/atencion-cliente/[atencionId]/resolve/route.ts"
const START_ROUTE =
  "app/api/atencion-cliente/[atencionId]/start-management/route.ts"
const TOUCH_ROUTE =
  "app/api/atencion-cliente/[atencionId]/touch-management/route.ts"
const SERVER =
  "lib/customer-atenciones/consultation-management.server.ts"
const DERIVE = "lib/commercial/derive-from-customer-service.ts"

test("Sprint 40.0: defer still runs commercial derive after RPC when Ventas", () => {
  const server = readFileSync(join(ROOT, SERVER), "utf8")

  // Sprint 39.0 events.latest removal superseded eventId∥derive Promise.all;
  // commercial derive remains on the defer → Ventas path.
  assert.ok(
    /deferCustomerAtencionConsultation[\s\S]*?shouldDeriveCommercial[\s\S]*?deriveCommercialOpportunityFromCustomerService/.test(
      server
    )
  )
})

test("Sprint 40.0 / 39.0: resolve+defer prefer RPC event_id (no forced events.latest)", () => {
  const server = readFileSync(join(ROOT, SERVER), "utf8")

  assert.ok(server.includes("recordLatestEventEliminated"))
  assert.ok(
    /resolveCustomerAtencionConsultation[\s\S]*?if \(result\.data\.eventId\) \{\s*recordLatestEventEliminated\(\)/.test(
      server
    )
  )
  assert.ok(
    /deferCustomerAtencionConsultation[\s\S]*?if \(result\.data\.eventId\) \{\s*recordLatestEventEliminated\(\)/.test(
      server
    )
  )
  // Fallback only when RPC lacks event_id (pre-migration).
  assert.ok(
    /consulta_resuelta/.test(server) &&
      /consulta_pendiente/.test(server)
  )
})

test("Sprint 40.0: defer/resolve routes parallelize auth + body + params", () => {
  for (const relative of [DEFER_ROUTE, RESOLVE_ROUTE]) {
    const source = readFileSync(join(ROOT, relative), "utf8")
    assert.ok(
      source.includes("Sprint 40.0"),
      `${relative} missing Sprint 40.0 marker`
    )
    assert.ok(
      /const \[auth, body, params\] = await Promise\.all\(/.test(source),
      `${relative} must Promise.all auth/body/params`
    )
    assert.ok(
      source.includes("requireCustomerActionAuthContext"),
      `${relative} must keep JWT auth`
    )
  }
})

test("Sprint 40.0: start/touch routes parallelize auth + params", () => {
  for (const relative of [START_ROUTE, TOUCH_ROUTE]) {
    const source = readFileSync(join(ROOT, relative), "utf8")
    assert.ok(
      /const \[auth, params\] = await Promise\.all\(/.test(source),
      `${relative} must Promise.all auth/params`
    )
  }
})

test("Sprint 40.0: commercial derive parallelizes independent DB reads", () => {
  const derive = readFileSync(join(ROOT, DERIVE), "utf8")

  assert.ok(derive.includes("Sprint 40.0"))
  assert.ok(
    /Promise\.all\(\[[\s\S]*?ensureCommercialDerivationCatalog[\s\S]*?customer_atenciones/.test(
      derive
    )
  )
  assert.ok(
    /Promise\.all\(\[[\s\S]*?from\("customers"\)[\s\S]*?from\("commercial_opportunities"\)/.test(
      derive
    )
  )
  assert.ok(
    /Promise\.all\(\[[\s\S]*?findCommercialPersonByContact[\s\S]*?commercial_people/.test(
      derive
    )
  )
  assert.ok(
    /Promise\.all\(\[[\s\S]*?insertCommercialActivity[\s\S]*?handOffAtencionAfterCommercialDerivation/.test(
      derive
    )
  )
  assert.ok(
    /Promise\.all\(\[[\s\S]*?commercial_sources[\s\S]*?commercial_activity_types/.test(
      derive
    )
  )
})
