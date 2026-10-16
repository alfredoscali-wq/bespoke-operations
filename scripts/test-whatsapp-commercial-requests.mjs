import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  buildWhatsappCommercialRequest,
  canReviewWhatsappRequests,
  createMemoryWhatsappRequests,
  resolveWhatsappRequestIdentity,
  resolveWhatsappRequestUpdate,
  snapshotWhatsappCommercialQuote,
} from "../lib/subscriptions/whatsapp-commercial-requests.ts"
import { quoteTvPlanDestination } from "../lib/subscriptions/tv-plan-coordination.ts"

const root = resolve(import.meta.dirname, "..")

function read(path) {
  return readFileSync(resolve(root, path), "utf8")
}

function service() {
  return {
    serviceId: "service-1",
    includedTvCode: "TV-BASICO",
    listPrice: 18000,
    catalogMonthlyPrice: 18000,
    conditionCode: null,
    discountPercent: null,
    activeComponents: [],
    catalogComponents: [
      { code: "PACK-FUTBOL", unitPrice: 6000, isRecurring: true },
      { code: "TV-FULL-UPGRADE", unitPrice: 8000, isRecurring: true },
    ],
  }
}

function request(overrides = {}) {
  const quoted = service()
  const quote = quoteTvPlanDestination({
    service: quoted,
    kind: "pack",
    latamAvailable: true,
  })
  const built = buildWhatsappCommercialRequest({
    id: "request-1",
    companyId: "company-a",
    originPhone: "3515551234",
    offer: "pack",
    matches: [{ customerId: "customer-1" }],
    phoneVerified: true,
    quote,
    service: quoted,
    customerAccepted: true,
    customerAcceptedAt: "2026-10-13T12:00:00.000Z",
    now: "2026-10-13T12:00:00.000Z",
    ...overrides,
  })
  assert.equal(built.ok, true)
  if (!built.ok) throw new Error(built.message)
  return built.request
}

test("un teléfono compartido o no verificado no vincula un cliente", () => {
  assert.deepEqual(
    resolveWhatsappRequestIdentity({
      matches: [{ customerId: "a" }, { customerId: "b" }],
      phoneVerified: true,
    }),
    { customerId: null, identityStatus: "unverified" }
  )
  assert.deepEqual(
    resolveWhatsappRequestIdentity({
      matches: [{ customerId: "a" }],
      phoneVerified: false,
    }),
    { customerId: null, identityStatus: "unverified" }
  )
  const unverified = request({
    phoneVerified: false,
    matches: [{ customerId: "customer-1" }],
  })
  assert.equal(unverified.customerId, null)
  assert.equal(unverified.quotedMonthlyFee, null)
  assert.equal(unverified.currentPlanLabel, null)
})

test("la cotización guardada sale del catálogo y no cambia al resolver", async () => {
  const quoted = service()
  const quote = quoteTvPlanDestination({
    service: quoted,
    kind: "pack",
    latamAvailable: true,
  })
  const snapshot = snapshotWhatsappCommercialQuote({ quote, service: quoted })
  assert.ok(snapshot)
  assert.equal(snapshot.quotedMonthlyFee, quote.nextMonthlyFee)
  assert.notEqual(snapshot.quotedMonthlyFee, quote.padronAmount)
  assert.equal(Object.hasOwn(snapshot, "padronAmount"), false)

  const store = createMemoryWhatsappRequests()
  const row = request()
  await store.insert(row)
  const reviewed = resolveWhatsappRequestUpdate({
    current: row,
    status: "in_review",
    operatorNotes: "",
    actorId: "user-1",
    now: "2026-10-13T13:00:00.000Z",
  })
  assert.equal(reviewed.ok, true)
  if (!reviewed.ok) return
  const approved = resolveWhatsappRequestUpdate({
    current: reviewed.request,
    status: "approved",
    operatorNotes: "Precio aceptado",
    actorId: "user-1",
    now: "2026-10-13T14:00:00.000Z",
  })
  assert.equal(approved.ok, true)
  if (!approved.ok) return
  const completed = resolveWhatsappRequestUpdate({
    current: approved.request,
    status: "completed",
    operatorNotes: "Resuelto por el operador",
    actorId: "user-1",
    now: "2026-10-13T15:00:00.000Z",
  })
  assert.equal(completed.ok, true)
  if (!completed.ok) return
  assert.equal(completed.request.quotedMonthlyFee, row.quotedMonthlyFee)
  assert.deepEqual(completed.request.quotedComponents, row.quotedComponents)
  await store.save(completed.request)
  const stored = await store.get("company-a", row.id)
  assert.equal(stored?.quotedMonthlyFee, row.quotedMonthlyFee)
  assert.equal(stored?.status, "completed")
})

test("otra empresa no ve la solicitud y un estado inválido no se guarda", async () => {
  const store = createMemoryWhatsappRequests()
  const row = request()
  await store.insert(row)
  assert.deepEqual(await store.list("company-b", "all"), [])
  assert.equal(await store.get("company-b", row.id), null)
  const skipped = resolveWhatsappRequestUpdate({
    current: row,
    status: "completed",
    operatorNotes: "salto",
    actorId: "user-1",
    now: "2026-10-13T13:00:00.000Z",
  })
  assert.equal(skipped.ok, false)
  assert.equal((await store.get("company-a", row.id))?.status, "pending")
})

test("solo administración puede registrar la resolución", () => {
  assert.equal(canReviewWhatsappRequests("administrador"), true)
  assert.equal(canReviewWhatsappRequests("administrativo"), true)
  assert.equal(canReviewWhatsappRequests("operario"), false)
  assert.equal(canReviewWhatsappRequests("atencion_cliente"), false)
})

test("esta etapa no ejecuta el cambio de plan de LATAM", () => {
  const files = [
    "components/subscriptions/tv-whatsapp-inbox.tsx",
    "app/api/subscriptions/whatsapp-requests/route.ts",
    "app/api/subscriptions/whatsapp-requests/[id]/route.ts",
    "lib/subscriptions/whatsapp-commercial-requests.ts",
    "lib/supabase/whatsapp-commercial-requests.queries.ts",
    "lib/subscriptions/whatsapp-customer-identity.ts",
    "lib/subscriptions/whatsapp-commercial-intake.ts",
    "lib/subscriptions/whatsapp-commercial-register.ts",
    "lib/integrations/whatsapp/webhook-guard.ts",
    "lib/integrations/whatsapp/graph-client.ts",
    "lib/integrations/whatsapp/commercial-image.ts",
    "lib/subscriptions/whatsapp-commercial-bot.ts",
    "lib/subscriptions/whatsapp-commercial-turn.ts",
    "lib/subscriptions/whatsapp-commercial-session.ts",
    "lib/subscriptions/whatsapp-outbound-delivery.ts",
    "lib/integrations/whatsapp/message-ledger.ts",
    "lib/subscriptions/whatsapp-commercial-catalog.ts",
    "app/api/integrations/whatsapp/webhook/route.ts",
    "supabase/migrations/20270110160000_tv_whatsapp_open_offer_uidx.sql",
    "scripts/test-whatsapp-open-offer-index.mjs",
    "app/api/isp/customers/[id]/whatsapp-requests/route.ts",
    "components/isp/isp-whatsapp-request-history.tsx",
    "supabase/migrations/20270110120000_tv_whatsapp_commercial_requests.sql",
    "supabase/migrations/20270110140000_tv_whatsapp_commercial_requests_customer_history.sql",
  ]
  for (const file of files) {
    const source = read(file)
    assert.doesNotMatch(source, /changeLatamClientPlan/)
    assert.doesNotMatch(source, /4500|7500|9900/)
  }
  const listRoute = read("app/api/subscriptions/whatsapp-requests/route.ts")
  const patchRoute = read("app/api/subscriptions/whatsapp-requests/[id]/route.ts")
  assert.match(listRoute, /requireSubscriptionsReadContext/)
  assert.match(patchRoute, /requireSubscriptionsWriteContext/)
  assert.match(listRoute, /auth\.companyId/)
  assert.match(patchRoute, /auth\.companyId/)
  assert.doesNotMatch(patchRoute, /record\.companyId|body\.companyId/)
  assert.match(
    read("components/subscriptions/subscriptions-module.tsx"),
    /<TvWhatsappInbox canWrite=\{canWrite\} \/>/
  )
})
