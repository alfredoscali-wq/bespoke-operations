import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { listLatamTvClients } from "../lib/integrations/latam-tv/client.ts"
import { LatamTvRequestError } from "../lib/integrations/latam-tv/errors.ts"
import {
  latamCatalogClient,
  resolveLatamIdentity,
} from "../lib/integrations/latam-tv/identity.ts"
import { latamLookupUiState } from "../lib/integrations/latam-tv/lookup-state.ts"

const BASE = "https://abnetv.cd-latam.com"
const TOKEN = "test-token-not-real"
const TORANZO = {
  abnet: "00006798",
  dni: "35226272",
  email: "aggerardotoranzo@hotmail.com.ar",
}
const LATAM_ID = "CRM-8841"

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
}

function row(overrides = {}) {
  return {
    id_iptv: 29,
    id_crm: LATAM_ID,
    usuario: TORANZO.email,
    dni: TORANZO.dni,
    estado: 1,
    nombres: "Gabriel",
    appaterno: "Toranzo",
    plan_nombre: "Plan Basico",
    ...overrides,
  }
}

function clients(...records) {
  return records.map((record) => latamCatalogClient(record))
}

function resolve(records, input) {
  return resolveLatamIdentity(clients(...records), input)
}

test("Toranzo: DNI y email obtienen el identificador LATAM, no el N° ABNet", () => {
  const decoy = row({
    id_iptv: 6798,
    id_crm: "6798",
    usuario: "otro@example.com",
    dni: "20111222",
    nombres: "Otro",
    appaterno: "Cliente",
  })
  const identity = resolve([row(), decoy], {
    nationalId: TORANZO.dni,
    email: TORANZO.email,
  })
  assert.equal(identity.outcome, "matched")
  assert.equal(identity.identifier, LATAM_ID)
  assert.equal(identity.source, "dni_email")
  assert.notEqual(identity.identifier, "6798")
  assert.notEqual(identity.identifier, TORANZO.abnet)
  assert.notEqual(identity.identifier, "29")
  assert.equal(JSON.stringify(identity).includes(TORANZO.email), false)
  assert.equal(JSON.stringify(identity).includes(TORANZO.dni), false)
})

test("el padrón se pide sin identificador y sin el N° ABNet", async () => {
  let method = ""
  let body = ""
  let url = ""
  const catalog = await listLatamTvClients({
    baseUrl: BASE,
    token: TOKEN,
    timeoutMs: 20_000,
    fetchImpl: async (input, init) => {
      url = String(input)
      method = init?.method ?? ""
      body = String(init?.body ?? "")
      return Response.json({
        error: false,
        code: 1,
        clients: [row()],
      })
    },
  })
  assert.equal(method, "GET")
  assert.equal(body, "{}")
  assert.equal(body.includes("6798"), false)
  assert.equal(body.includes(TORANZO.abnet), false)
  assert.equal(url.includes("/api/get-clients"), true)
  assert.equal(url.includes(TOKEN), true)
  assert.equal(JSON.stringify(catalog).includes(TOKEN), false)
  assert.equal(catalog[0].identifier, LATAM_ID)
})

test("coincidencia exacta de DNI y email", () => {
  const identity = resolve([row({ estado: 0 })], {
    nationalId: "35.226.272",
    email: "  AgGerardoToranzo@hotmail.com.ar ",
  })
  assert.equal(identity.outcome, "matched")
  assert.equal(identity.identifier, LATAM_ID)
  assert.equal(identity.status, "disabled")
  const view = latamLookupUiState(true, { success: true, ...identity })
  assert.equal(view.phase, "suspended")
  assert.equal(view.identifier, LATAM_ID)
  assert.equal(view.label, "LATAM: Suspendido")
})

test("solo DNI es revisión y no vincula", () => {
  const identity = resolve(
    [row({ usuario: "distinto@hotmail.com.ar" })],
    { nationalId: TORANZO.dni, email: TORANZO.email }
  )
  assert.equal(identity.outcome, "partial_match")
  assert.equal(identity.matchedOn, "dni")
  assert.equal(identity.candidates[0].identifier, LATAM_ID)
  assert.notEqual(identity.candidates[0].identifier, "6798")
  const view = latamLookupUiState(true, { success: true, ...identity })
  assert.equal(view.phase, "partial")
  assert.equal(view.label, "LATAM: Requiere revisión")
  assert.match(view.detail, /DNI/)
})

test("solo email es revisión y no vincula", () => {
  const identity = resolve([row({ dni: "40111222" })], {
    nationalId: TORANZO.dni,
    email: TORANZO.email,
  })
  assert.equal(identity.outcome, "partial_match")
  assert.equal(identity.matchedOn, "email")
  const view = latamLookupUiState(true, { success: true, ...identity })
  assert.equal(view.phase, "partial")
  assert.match(view.detail, /email/)
})

test("sin coincidencia queda no registrado", () => {
  const identity = resolve([row({ dni: "40111222", usuario: "otro@example.com" })], {
    nationalId: TORANZO.dni,
    email: TORANZO.email,
  })
  assert.deepEqual(identity, { outcome: "not_found", reason: "no_match" })
  const view = latamLookupUiState(true, { success: true, ...identity })
  assert.equal(view.phase, "unregistered")
  assert.equal(view.label, "LATAM: No registrado")
})

test("varios candidatos quedan ambiguos", () => {
  const second = row({
    id_crm: "CRM-9000",
    id_iptv: 30,
    usuario: "aggerardotoranzo@hotmail.com.ar",
    dni: "35226272",
  })
  const identity = resolve([row(), second], {
    nationalId: TORANZO.dni,
    email: TORANZO.email,
  })
  assert.equal(identity.outcome, "ambiguous")
  assert.equal(identity.candidates.length, 2)
  assert.deepEqual(
    identity.candidates.map((candidate) => candidate.identifier).sort(),
    ["CRM-8841", "CRM-9000"]
  )
  const split = resolve(
    [
      row({ usuario: "otro@example.com" }),
      row({ id_crm: "CRM-9000", dni: "40111222" }),
    ],
    { nationalId: TORANZO.dni, email: TORANZO.email }
  )
  assert.equal(split.outcome, "ambiguous")
  assert.equal(split.candidates.length, 2)
  const view = latamLookupUiState(true, { success: true, ...identity })
  assert.equal(view.phase, "ambiguous")
  assert.equal(view.label, "LATAM: Coincidencia ambigua")
  assert.equal(JSON.stringify(identity).includes(TORANZO.email), false)
})

test("un error de LATAM queda no disponible", async () => {
  await assert.rejects(
    () =>
      listLatamTvClients({
        baseUrl: BASE,
        token: TOKEN,
        fetchImpl: async () => new Response("down", { status: 500 }),
      }),
    (error) => error instanceof LatamTvRequestError && error.kind === "unavailable"
  )
  await assert.rejects(
    () =>
      listLatamTvClients({
        baseUrl: BASE,
        token: TOKEN,
        fetchImpl: async () => {
          throw new Error("timeout")
        },
      }),
    (error) => {
      assert.equal(error instanceof LatamTvRequestError, true)
      assert.equal(String(error.message).includes(TOKEN), false)
      return error.kind === "unavailable"
    }
  )
  assert.equal(
    latamLookupUiState(false, { success: false, message: "No fue posible consultar LATAM TV." })
      .label,
    "LATAM: No disponible"
  )
})

test("sin DNI o sin email no hay match seguro", () => {
  assert.deepEqual(
    resolveLatamIdentity(clients(row()), { nationalId: null, email: null }),
    { outcome: "not_found", reason: "missing_identity" }
  )
  assert.equal(
    resolve([row()], { nationalId: null, email: TORANZO.email }).outcome,
    "partial_match"
  )
  assert.equal(
    resolve([row()], { nationalId: TORANZO.dni, email: null }).outcome,
    "partial_match"
  )
  assert.equal(
    resolve([row()], { nationalId: TORANZO.dni, email: "no-es-email" }).outcome,
    "partial_match"
  )
})

test("un cliente ya vinculado usa el identificador guardado", () => {
  const identity = resolve(
    [row(), row({ id_crm: "6798", dni: "20111222", usuario: "otro@example.com" })],
    {
      nationalId: TORANZO.dni,
      email: TORANZO.email,
      linkedIdentifier: LATAM_ID,
    }
  )
  assert.equal(identity.outcome, "matched")
  assert.equal(identity.source, "link")
  assert.equal(identity.identifier, LATAM_ID)
  assert.notEqual(identity.identifier, "6798")
})

test("id_iptv y el N° ABNet no reemplazan un identificador LATAM ausente", () => {
  const identity = resolve([row({ id_crm: null, id_iptv: 29 })], {
    nationalId: TORANZO.dni,
    email: TORANZO.email,
  })
  assert.equal(identity.outcome, "matched")
  assert.equal(identity.identifier, null)
  const view = latamLookupUiState(true, { success: true, ...identity, status: "enabled" })
  assert.equal(view.phase, "active")
  assert.equal(view.identifier, null)
  assert.match(view.detail, /identificador/)
})

test("la consulta no escribe en LATAM ni persiste un identificador inventado", () => {
  const route = read("app/api/integrations/latam-tv/customers/[customerId]/route.ts")
  const dialog = read("components/subscriptions/latam-tv-row-dialog.tsx")
  assert.match(route, /listLatamTvClients/)
  assert.match(route, /resolveLatamIdentity/)
  assert.match(route, /linkedIdentifier: null/)
  assert.match(route, /\.eq\("company_id", auth\.companyId\)/)
  assert.doesNotMatch(route, /getLatamTvClientByIdentifier/)
  assert.doesNotMatch(route, /external_customer_code/)
  assert.doesNotMatch(route, /6798/)
  for (const path of [
    "register-client",
    "modify-client",
    "modify-password",
    "disable-client",
    "enable-client",
    "delete-client",
  ]) {
    assert.equal(route.includes(path), false)
  }
  assert.doesNotMatch(route, /searchParams\.get\("token"\)/)
  assert.doesNotMatch(route, /console\.(log|info|debug|warn|error)\([^)]*\$\{/)
  assert.match(dialog, /LATAM: No registrado/)
  assert.match(dialog, /LATAM: Requiere revisión/)
  assert.match(dialog, /LATAM: Coincidencia ambigua/)
  assert.match(dialog, /LATAM: No disponible/)
  assert.doesNotMatch(dialog, /LATAM_TV_API_TOKEN/)
})
