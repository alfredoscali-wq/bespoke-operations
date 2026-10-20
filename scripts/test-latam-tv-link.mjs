/**
 * Vinculación de una ficha LATAM existente. No llama a la API real.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  linkExistingLatamTvClient,
  planLatamAbnetLink,
} from "../lib/integrations/latam-tv/client.ts"
import { latamCatalogClient } from "../lib/integrations/latam-tv/identity.ts"
import { padronLatamMode } from "../lib/subscriptions/padron-latam-mode.ts"

const BASE = "https://abnetv.cd-latam.com"
const TOKEN = "latam-link-token-do-not-leak"
const CRM = "6794"
const IPTV = "25"
const DNI = "30111222"
const EMAIL = "persona@example.com"
const CUSTOMER = "a42b489e-1f45-4f4e-8f61-1b9bc57e8b12"

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function catalogRow(overrides = {}) {
  return latamCatalogClient({
    id_iptv: Number(IPTV),
    id_crm: null,
    dni: DNI,
    usuario: EMAIL,
    status: 1,
    plan_nombre: "Básico",
    ...overrides,
  })
}

function plan(catalog, extra = {}) {
  return planLatamAbnetLink({
    abnetNumber: CRM,
    nationalId: DNI,
    email: EMAIL,
    catalog,
    ...extra,
  })
}

test("una sola ficha con id_iptv válido queda lista para vincular", () => {
  const decision = plan([catalogRow()])
  assert.deepEqual(decision, { action: "link", iptvId: IPTV, crmId: CRM })
  assert.notEqual(decision.iptvId, CRM)
})

test("sin coincidencia se conserva el alta nueva", () => {
  assert.deepEqual(
    plan([catalogRow({ dni: "20999888", usuario: "otra@example.com" })]),
    { action: "signup" }
  )
})

test("dos fichas con el mismo DNI y email quedan en revisión", () => {
  assert.deepEqual(
    plan([catalogRow(), catalogRow({ id_iptv: 26 })]),
    { action: "review", reason: "ambiguous" }
  )
})

test("un id_crm distinto en la misma ficha no se vincula", () => {
  assert.deepEqual(
    plan([catalogRow({ id_crm: "1111" })]),
    { action: "review", reason: "incompatible" }
  )
})

test("el mismo N° ABNet en otro id_iptv no se vincula", () => {
  assert.deepEqual(
    plan([
      catalogRow(),
      catalogRow({ id_iptv: 80, id_crm: CRM, dni: "10999111", usuario: "otro@example.com" }),
    ]),
    { action: "review", reason: "incompatible" }
  )
})

test("el id_iptv no puede ser el N° ABNet ni un código CLI", () => {
  assert.equal(plan([catalogRow({ id_iptv: Number(CRM) })]).action, "review")
  assert.deepEqual(
    planLatamAbnetLink({
      abnetNumber: "CLI-005788",
      nationalId: DNI,
      email: EMAIL,
      catalog: [catalogRow()],
    }),
    { action: "review", reason: "incompatible" }
  )
})

test("faltan DNI o email y no hay escritura", async () => {
  const calls = []
  const result = await linkExistingLatamTvClient(
    { customerId: CUSTOMER, abnetNumber: CRM, nationalId: DNI, email: "" },
    {
      baseUrl: BASE,
      token: TOKEN,
      fetchImpl: async (url, init) => {
        calls.push(String(url))
        return jsonResponse({ code: 1, clients: [] })
      },
    }
  )
  assert.deepEqual(result, { outcome: "review", reason: "missing_identity" })
  assert.equal(calls.length, 0)
})

function install(sequence) {
  const calls = []
  let index = 0
  return {
    calls,
    fetchImpl: async (url, init) => {
      const parsed = new URL(String(url))
      calls.push({
        path: parsed.pathname,
        method: init?.method,
        body: String(init?.body ?? ""),
      })
      const next = sequence[Math.min(index, sequence.length - 1)]
      index += 1
      if (typeof next === "function") return next(calls)
      return jsonResponse(next)
    },
  }
}

const foundCatalog = {
  code: 1,
  clients: [
    {
      id_iptv: Number(IPTV),
      id_crm: null,
      dni: DNI,
      usuario: EMAIL,
      status: 1,
    },
  ],
}

const confirmedProbe = {
  code: 1,
  clients: [{ id_iptv: IPTV, id_crm: CRM, status: 1 }],
}

test("la vinculación única sincroniza una vez y confirma el mismo vínculo", async () => {
  const captured = install([foundCatalog, { error: false, code: 1 }, confirmedProbe])
  const result = await linkExistingLatamTvClient(
    { customerId: `${CUSTOMER}-ok`, abnetNumber: `0000${CRM}`, nationalId: DNI, email: EMAIL },
    { baseUrl: BASE, token: TOKEN, fetchImpl: captured.fetchImpl }
  )
  assert.deepEqual(result, { outcome: "linked", iptvId: IPTV, crmId: CRM })
  assert.deepEqual(
    captured.calls.map((call) => call.path),
    ["/api/get-clients", "/api/sync-client", "/api/get-clients"]
  )
  assert.equal(captured.calls[1].method, "POST")
  assert.deepEqual(JSON.parse(captured.calls[1].body), { id_iptv: IPTV, id_crm: CRM })
  assert.equal(captured.calls.some((call) => call.path === "/api/register-client"), false)
  assert.equal(JSON.stringify(result).includes(TOKEN), false)
})

test("un código de sincronización distinto de 1 no se reintenta", async () => {
  const captured = install([foundCatalog, { error: true, code: 4 }])
  const result = await linkExistingLatamTvClient(
    { customerId: `${CUSTOMER}-fail`, abnetNumber: CRM, nationalId: DNI, email: EMAIL },
    { baseUrl: BASE, token: TOKEN, fetchImpl: captured.fetchImpl }
  )
  assert.equal(result.outcome, "sync_failed")
  assert.equal(captured.calls.filter((call) => call.path === "/api/sync-client").length, 1)
  assert.equal(captured.calls.some((call) => call.path === "/api/register-client"), false)
})

test("si la reconsulta no confirma el vínculo no se vuelve a sincronizar", async () => {
  const captured = install([
    foundCatalog,
    { error: false, code: 1 },
    { code: 1, clients: [{ id_iptv: "99", id_crm: CRM }] },
  ])
  const result = await linkExistingLatamTvClient(
    { customerId: `${CUSTOMER}-probe`, abnetNumber: CRM, nationalId: DNI, email: EMAIL },
    { baseUrl: BASE, token: TOKEN, fetchImpl: captured.fetchImpl }
  )
  assert.equal(result.outcome, "verification_failed")
  assert.equal(captured.calls.filter((call) => call.path === "/api/sync-client").length, 1)
})

test("una segunda solicitud del mismo cliente no escribe otra vez", async () => {
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  let syncs = 0
  const fetchImpl = async (url, init) => {
    const path = new URL(String(url)).pathname
    const body = String(init?.body ?? "")
    if (path === "/api/sync-client") {
      syncs += 1
      await gate
      return jsonResponse({ code: 1 })
    }
    if (body.includes("identificador")) return jsonResponse(confirmedProbe)
    return jsonResponse(foundCatalog)
  }
  const deps = { baseUrl: BASE, token: TOKEN, fetchImpl }
  const input = { customerId: `${CUSTOMER}-busy`, abnetNumber: CRM, nationalId: DNI, email: EMAIL }
  const first = linkExistingLatamTvClient(input, deps)
  const second = await linkExistingLatamTvClient(input, deps)
  assert.equal(second.outcome, "busy")
  release()
  assert.equal((await first).outcome, "linked")
  assert.equal(syncs, 1)
})

test("el padrón distingue alta, vinculación y revisión sin cambiar al ya vinculado", () => {
  const row = {
    abnetCustomerNumber: "00006794",
    bespokeCustomerId: CUSTOMER,
    bespokeLink: "one",
    latamCredentialGap: null,
  }
  const base = { identifier: null, iptvId: null, username: null, planName: null }
  assert.equal(padronLatamMode(row, { 6794: { phase: "unregistered", ...base } }).kind, "signup")
  assert.equal(
    padronLatamMode(row, { 6794: { phase: "unregistered", ...base, link: "absent" } }).kind,
    "signup"
  )
  assert.equal(
    padronLatamMode(row, { 6794: { phase: "unregistered", ...base, link: "ready" } }).kind,
    "link"
  )
  assert.equal(
    padronLatamMode(row, { 6794: { phase: "unregistered", ...base, link: "review" } }).kind,
    "review"
  )
  assert.equal(
    padronLatamMode(row, {
      6794: { phase: "active", ...base, identifier: "6794", iptvId: IPTV, link: "ready" },
    }).kind,
    "active"
  )
})

test("la interfaz pide confirmación y el servidor no acepta el id enviado por el navegador", () => {
  const module = read("components/subscriptions/subscriptions-module.tsx")
  const dialog = read("components/subscriptions/latam-tv-row-dialog.tsx")
  const route = read("app/api/integrations/latam-tv/customers/[customerId]/link/route.ts")
  const padron = read("app/api/subscriptions/abnet-padron/route.ts")
  assert.match(module, /Vincular con LATAM/)
  assert.match(dialog, /postLink\(/)
  assert.match(dialog, /confirm: true/)
  assert.doesNotMatch(dialog, /postLink[\s\S]{0,500}register/)
  assert.match(route, /linkExistingLatamTvClient/)
  assert.match(route, /latamIdentifierFromCustomer/)
  assert.match(route, /requireSubscriptionsWriteContext/)
  assert.match(route, /auth\.companyId/)
  assert.doesNotMatch(route, /register-client|customer_number/)
  assert.doesNotMatch(route, /body\.id_iptv|body\.id_crm|body\.identificador/)
  assert.match(padron, /planLatamAbnetLink/)
  assert.doesNotMatch(padron, /sync-client|register-client/)
})
