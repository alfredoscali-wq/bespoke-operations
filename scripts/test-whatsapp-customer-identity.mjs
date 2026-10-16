import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  readWhatsappCommercialEvents,
  resolveWhatsappBusinessCompany,
  verifyMetaWebhookSignature,
} from "../lib/integrations/whatsapp/webhook-guard.ts"
import { prepareWhatsappCommercialIntake } from "../lib/subscriptions/whatsapp-commercial-intake.ts"
import { quoteTvPlanDestination } from "../lib/subscriptions/tv-plan-coordination.ts"

const COMPANY = "11111111-1111-4111-8111-111111111111"

function service(id = "service-1") {
  return {
    serviceId: id,
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

function intake(overrides = {}) {
  return prepareWhatsappCommercialIntake({
    id: "request-1",
    companyId: "company-a",
    originPhone: "0351 555-1234",
    offer: "pack",
    contacts: [
      {
        customerId: "customer-1",
        phone: "+54 9 351 555-1234",
        whatsapp: null,
      },
    ],
    services: [service()],
    now: "2026-10-14T03:00:00.000Z",
    ...overrides,
  })
}

test("un teléfono compartido o duplicado no vincula ni cotiza", () => {
  const shared = intake({
    contacts: [
      { customerId: "customer-1", phone: "3515551234", whatsapp: null },
      { customerId: "customer-2", phone: null, whatsapp: "+5493515551234" },
    ],
  })
  assert.equal(shared.ok, true)
  if (!shared.ok) return
  assert.equal(shared.request.customerId, null)
  assert.equal(shared.request.identityStatus, "unverified")
  assert.equal(shared.request.quotedMonthlyFee, null)
  assert.equal(shared.request.currentPlanLabel, null)
  assert.equal(shared.request.destinationPlanLabel, null)
  assert.equal(Object.hasOwn(shared.request, "name"), false)
  assert.equal(Object.hasOwn(shared.request, "dni"), false)
})

test("un teléfono incompleto o distinto no alcanza para identificar", () => {
  const incomplete = intake({
    contacts: [{ customerId: "customer-1", phone: "555", whatsapp: "" }],
  })
  assert.equal(incomplete.ok, true)
  if (!incomplete.ok) return
  assert.equal(incomplete.request.customerId, null)
  assert.equal(incomplete.request.quotedMonthlyFee, null)

  const other = intake({
    contacts: [{ customerId: "customer-1", phone: "3515559999", whatsapp: null }],
  })
  assert.equal(other.ok, true)
  if (!other.ok) return
  assert.equal(other.request.customerId, null)
})

test("un único cliente usa el servicio vigente y el precio del catálogo", () => {
  const quoted = service()
  const quote = quoteTvPlanDestination({
    service: quoted,
    kind: "pack",
    latamAvailable: true,
  })
  const linked = intake()
  assert.equal(linked.ok, true)
  if (!linked.ok) return
  assert.equal(linked.request.customerId, "customer-1")
  assert.equal(linked.request.identityStatus, "verified")
  assert.equal(linked.request.quotedMonthlyFee, quote.nextMonthlyFee)
  assert.notEqual(linked.request.quotedMonthlyFee, quote.padronAmount)

  const ambiguousService = intake({ services: [service("a"), service("b")] })
  assert.equal(ambiguousService.ok, true)
  if (!ambiguousService.ok) return
  assert.equal(ambiguousService.request.customerId, "customer-1")
  assert.equal(ambiguousService.request.quotedMonthlyFee, null)
  assert.equal(ambiguousService.request.currentPlanLabel, null)
})

test("la firma y el número comercial deciden la empresa", () => {
  const raw = JSON.stringify({
    object: "whatsapp_business_account",
    company_id: "otra-empresa",
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "1099" },
              messages: [
                { id: "wamid.1", from: "5493515551234", type: "text", text: { body: "privado" } },
                {
                  id: "wamid.2",
                  from: "5493515551234",
                  type: "interactive",
                  interactive: { button_reply: { id: "pack", title: "Pack" } },
                },
              ],
            },
          },
        ],
      },
    ],
  })
  const secret = "test-secret"
  const signature = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`
  assert.equal(
    verifyMetaWebhookSignature({ rawBody: raw, signatureHeader: signature, appSecret: secret }),
    true
  )
  assert.equal(
    verifyMetaWebhookSignature({
      rawBody: raw,
      signatureHeader: signature,
      appSecret: "otro-secreto",
    }),
    false
  )

  const parsed = readWhatsappCommercialEvents(JSON.parse(raw))
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.phoneNumberId, "1099")
  assert.deepEqual(parsed.events, [
    { externalMessageId: "wamid.2", from: "5493515551234", offer: "pack" },
  ])
  assert.equal(JSON.stringify(parsed).includes("privado"), false)
  assert.equal(JSON.stringify(parsed).includes("otra-empresa"), false)

  const company = resolveWhatsappBusinessCompany({
    configuredPhoneNumberId: "1099",
    configuredCompanyId: COMPANY,
    payloadPhoneNumberId: parsed.phoneNumberId,
  })
  assert.deepEqual(company, { ok: true, companyId: COMPANY })
  assert.deepEqual(
    resolveWhatsappBusinessCompany({
      configuredPhoneNumberId: "1099",
      configuredCompanyId: COMPANY,
      payloadPhoneNumberId: "otro-numero",
    }),
    { ok: false }
  )
})

test("el alta y la ficha no cambian LATAM ni copian la ficha del cliente", () => {
  const root = resolve(import.meta.dirname, "..")
  const register = readFileSync(
    resolve(root, "lib/subscriptions/whatsapp-commercial-register.ts"),
    "utf8"
  )
  const history = readFileSync(
    resolve(root, "components/isp/isp-whatsapp-request-history.tsx"),
    "utf8"
  )
  const webhook = readFileSync(
    resolve(root, "app/api/integrations/whatsapp/webhook/route.ts"),
    "utf8"
  )
  const contacts = readFileSync(
    resolve(root, "lib/supabase/whatsapp-commercial-requests.queries.ts"),
    "utf8"
  )
  assert.match(register, /listWhatsappIdentityContacts\(admin, companyId/)
  assert.match(register, /loadTvPlanCommercialServices\(admin, companyId/)
  assert.doesNotMatch(register, /changeLatamClientPlan/)
  assert.match(webhook, /verifyMetaWebhookSignature/)
  assert.match(webhook, /resolveWhatsappBusinessCompany/)
  assert.match(webhook, /company\.companyId/)
  assert.doesNotMatch(webhook, /body\.companyId|payload\.company_id/)
  assert.match(contacts, /select\("id, phone, whatsapp"\)/)
  assert.match(contacts, /\.eq\("company_id", companyId\)/)
  assert.doesNotMatch(history, /originPhone|customer\.name|customer\.phone|customer\.dni/)
  assert.match(
    readFileSync(resolve(root, "lib/auth/routes.ts"), "utf8"),
    /pathname === "\/api\/integrations\/whatsapp\/webhook"/
  )
})
