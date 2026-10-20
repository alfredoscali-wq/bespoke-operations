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
import {
  associateConfirmedAbnetCustomer,
  NIEVA_ABNET_REPAIR,
  planBespokeAbnetAssociation,
  planNievaAbnetRepair,
} from "../lib/subscriptions/bespoke-abnet-association.ts"
import {
  classifyPadronLatamLink,
  resolvePadronLinkIdentities,
} from "../lib/subscriptions/padron-latam-link.ts"

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
  assert.equal(
    padronLatamMode(
      { ...row, bespokeCustomerId: null, bespokeLink: "none" },
      {
        6794: {
          phase: "active",
          ...base,
          identifier: "6794",
          iptvId: "28",
          link: "ready",
          linkCustomerId: NIEVA_ABNET_REPAIR.customerId,
        },
      }
    ).kind,
    "associate"
  )
  assert.equal(
    padronLatamMode(
      { ...row, bespokeCustomerId: null, bespokeLink: "none" },
      { 6794: { phase: "active", ...base, identifier: "6794", iptvId: "28" } }
    ).kind,
    "blocked"
  )
})

test("la interfaz pide confirmación y el servidor no acepta el id enviado por el navegador", () => {
  const module = read("components/subscriptions/subscriptions-module.tsx")
  const dialog = read("components/subscriptions/latam-tv-row-dialog.tsx")
  const route = read("app/api/integrations/latam-tv/customers/[customerId]/link/route.ts")
  const padron = read("app/api/subscriptions/abnet-padron/route.ts")
  const classifier = read("lib/subscriptions/padron-latam-link.ts")
  assert.match(module, /Vincular con LATAM/)
  assert.match(dialog, /postLink\(/)
  assert.match(dialog, /confirm: true/)
  assert.match(dialog, /linkCustomerId/)
  assert.doesNotMatch(dialog, /postLink[\s\S]{0,800}register/)
  assert.match(route, /linkExistingLatamTvClient/)
  assert.match(route, /associateConfirmedAbnetCustomer/)
  assert.match(route, /outcome: "partial"/)
  assert.match(route, /latamIdentifierFromCustomer/)
  assert.match(route, /requireSubscriptionsWriteContext/)
  assert.match(route, /auth\.companyId/)
  assert.doesNotMatch(route, /register-client|customer_number/)
  assert.doesNotMatch(route, /sync-client|syncLatamTvClient/)
  assert.doesNotMatch(route, /body\.id_iptv|body\.id_crm|body\.identificador/)
  assert.doesNotMatch(route, /\.update\(/)
  const association = read("lib/subscriptions/bespoke-abnet-association.ts")
  assert.match(association, /planLatamAbnetLink/)
  assert.match(association, /external_customer_code\.is\.null/)
  assert.match(dialog, /link_partial/)
  assert.match(dialog, /onPadronRefresh/)
  assert.match(dialog, /Completar asociación en Bespoke/)
  assert.match(dialog, /Vinculación completada correctamente/)
  assert.match(dialog, /LATAM vinculado; falta completar la asociación en Bespoke/)
  assert.match(dialog, /No se pudo vincular con LATAM TV/)
  const effect = dialog.slice(dialog.indexOf("useEffect(() => {"), dialog.indexOf("async function postSignup"))
  const hold = effect.indexOf("linkHoldRef.current.key === linkHoldKey")
  const reset = effect.indexOf('setPhase("link_confirm")')
  assert.ok(hold >= 0 && reset > hold)
  const post = dialog.slice(dialog.indexOf("async function postLink"), dialog.indexOf("function choosePlan"))
  assert.match(post, /phase: "linked"/)
  assert.match(post, /phase: "link_partial"/)
  assert.match(post, /setActionError/)
  assert.doesNotMatch(post, /sync-client|syncLatamTvClient|register-client/)
  const linkedAt = post.indexOf('phase: "linked"')
  const partialAt = post.indexOf('phase: "link_partial"')
  const refreshAt = post.indexOf("onPadronRefresh()")
  assert.ok(linkedAt >= 0 && refreshAt > linkedAt)
  assert.ok(partialAt >= 0 && post.indexOf("onPadronRefresh()", refreshAt + 1) > partialAt)
  assert.match(padron, /classifyPadronLatamLink/)
  assert.equal(padron.match(/await listLatamTvClients/g)?.length, 1)
  assert.match(classifier, /planLatamAbnetLink/)
  assert.doesNotMatch(padron, /sync-client|register-client/)
  assert.doesNotMatch(classifier, /sync-client|register-client/)
})

function ficha(overrides = {}) {
  return {
    id: CUSTOMER,
    name: "Nieva Emiliana",
    externalCustomerCode: null,
    dni: DNI,
    email: EMAIL,
    ...overrides,
  }
}

function identityFor(number, customers, name = "Nieva Emiliana") {
  return resolvePadronLinkIdentities({
    rows: [{ abnetNumber: number, customerName: name }],
    customers,
  }).get(number)
}

test("la ficha encontrada por N° ABNet se compara con el catálogo", () => {
  const identity = identityFor(CRM, [ficha({ externalCustomerCode: "00006794", name: "Otro nombre" })])
  assert.equal(identity.status, "ready")
  assert.deepEqual(
    classifyPadronLatamLink({ abnetNumber: CRM, identity, catalog: [catalogRow()] }),
    { link: "ready", customerId: CUSTOMER }
  )
})

test("sin código externo, una coincidencia única de DNI y correo queda lista para vincular", () => {
  const identity = identityFor(CRM, [ficha()])
  assert.equal(identity.status, "ready")
  const mark = classifyPadronLatamLink({ abnetNumber: CRM, identity, catalog: [catalogRow()] })
  assert.deepEqual(mark, { link: "ready", customerId: CUSTOMER })
  assert.equal(
    padronLatamMode(
      { abnetCustomerNumber: CRM, bespokeCustomerId: null, bespokeLink: "none", latamCredentialGap: null },
      { 6794: { phase: "unregistered", identifier: null, iptvId: null, username: null, planName: null, link: mark.link } }
    ).kind,
    "link"
  )
})

test("un nombre coincidente no vincula si el DNI o el correo no confirman la identidad", () => {
  const identity = identityFor(CRM, [ficha()])
  assert.equal(identity.status, "ready")
  const dniOnly = classifyPadronLatamLink({
    abnetNumber: CRM,
    identity,
    catalog: [catalogRow({ usuario: "otra@example.com" })],
  })
  const emailOnly = classifyPadronLatamLink({
    abnetNumber: CRM,
    identity,
    catalog: [catalogRow({ dni: "20999888" })],
  })
  assert.notEqual(dniOnly.link, "ready")
  assert.notEqual(emailOnly.link, "ready")
  assert.equal(dniOnly.link, "review")
  assert.equal(emailOnly.link, "review")
})

test("sin coincidencia de DNI y correo se conserva el alta", () => {
  const identity = identityFor(CRM, [ficha()])
  assert.deepEqual(
    classifyPadronLatamLink({
      abnetNumber: CRM,
      identity,
      catalog: [catalogRow({ dni: "20999888", usuario: "otra@example.com" })],
    }),
    { link: "absent", customerId: CUSTOMER }
  )
})

test("sin ficha no se fuerza una revisión", () => {
  const identity = identityFor(CRM, [])
  assert.deepEqual(classifyPadronLatamLink({ abnetNumber: CRM, identity, catalog: [catalogRow()] }), {
    link: "skip",
  })
})

test("DNI o correo faltantes quedan en revisión y no consultan el catálogo", () => {
  const identity = identityFor(CRM, [ficha({ email: "" })])
  assert.deepEqual(
    classifyPadronLatamLink({ abnetNumber: CRM, identity, catalog: [] }),
    { link: "review", customerId: CUSTOMER }
  )
})

test("varias fichas con el mismo nombre quedan en revisión", () => {
  const identity = identityFor(CRM, [ficha(), ficha({ id: `${CUSTOMER}-2` })])
  assert.equal(identity.status, "ambiguous")
  assert.deepEqual(classifyPadronLatamLink({ abnetNumber: CRM, identity, catalog: [catalogRow()] }), {
    link: "review",
  })
})

test("varias fichas LATAM con el mismo DNI y correo quedan en revisión", () => {
  const identity = identityFor(CRM, [ficha()])
  assert.equal(
    classifyPadronLatamLink({
      abnetNumber: CRM,
      identity,
      catalog: [catalogRow(), catalogRow({ id_iptv: 26 })],
    }).link,
    "review"
  )
})

test("un id_iptv inválido no se vincula", () => {
  const identity = identityFor(CRM, [ficha()])
  assert.equal(
    classifyPadronLatamLink({
      abnetNumber: CRM,
      identity,
      catalog: [catalogRow({ id_iptv: Number(CRM) })],
    }).link,
    "review"
  )
})

test("un vínculo previo incompatible no se vincula", () => {
  const identity = identityFor(CRM, [ficha()])
  assert.equal(
    classifyPadronLatamLink({
      abnetNumber: CRM,
      identity,
      catalog: [catalogRow({ id_crm: "1111" })],
    }).link,
    "review"
  )
})

test("un error al leer el catálogo deja la fila en revisión", () => {
  const identity = identityFor(CRM, [ficha()])
  assert.deepEqual(classifyPadronLatamLink({ abnetNumber: CRM, identity, catalog: null }), {
    link: "review",
    customerId: CUSTOMER,
  })
})

test("la misma ficha no habilita dos abonos", () => {
  const resolved = resolvePadronLinkIdentities({
    rows: [
      { abnetNumber: "6794", customerName: "Nieva Emiliana" },
      { abnetNumber: "6793", customerName: "Nieva Emiliana" },
    ],
    customers: [ficha()],
  })
  assert.equal(resolved.get("6794").status, "ambiguous")
  assert.equal(resolved.get("6793").status, "ambiguous")
})

const NIEVA = NIEVA_ABNET_REPAIR.customerId
const COMPANY = "00000000-0000-4000-8000-000000000002"

function nievaCatalog(overrides = {}) {
  return catalogRow({ id_iptv: Number(NIEVA_ABNET_REPAIR.iptvId), id_crm: CRM, ...overrides })
}

function customerStore(initial) {
  const rows = initial.map((row) => ({ ...row }))
  const updates = []
  function matches(row, filters) {
    return filters.every((filter) => {
      if (filter.op === "eq") return row[filter.column] === filter.value
      if (filter.op === "is") return row[filter.column] == null
      if (filter.op === "or") {
        const code = row.external_customer_code
        return code == null || code === ""
      }
      return false
    })
  }
  return {
    rows,
    updates,
    from() {
      const filters = []
      const query = {
        select() {
          return query
        },
        eq(column, value) {
          filters.push({ op: "eq", column, value })
          return query
        },
        is(column, value) {
          filters.push({ op: "is", column, value })
          return query
        },
        order() {
          return query
        },
        range() {
          return Promise.resolve({
            data: rows.filter((row) => matches(row, filters)),
            error: null,
          })
        },
        update(values) {
          updates.push(values)
          const writeFilters = []
          const write = {
            eq(column, value) {
              writeFilters.push({ op: "eq", column, value })
              return write
            },
            is(column, value) {
              writeFilters.push({ op: "is", column, value })
              return write
            },
            or() {
              writeFilters.push({ op: "or" })
              return write
            },
            select() {
              const matched = rows.filter((row) => matches(row, writeFilters))
              for (const row of matched) Object.assign(row, values)
              return Promise.resolve({
                data: matched.map((row) => ({ id: row.id })),
                error: null,
              })
            },
          }
          return write
        },
      }
      return query
    },
  }
}

function nievaRow(overrides = {}) {
  return {
    id: NIEVA,
    company_id: COMPANY,
    dni: DNI,
    email: EMAIL,
    external_customer_code: null,
    deleted_at: null,
    ...overrides,
  }
}

test("si Latam ya tiene el id_crm la recuperación no llama a sync-client", async () => {
  const captured = install([
    {
      code: 1,
      clients: [{ id_iptv: Number(IPTV), id_crm: CRM, dni: DNI, usuario: EMAIL, status: 1 }],
    },
    confirmedProbe,
  ])
  const result = await linkExistingLatamTvClient(
    { customerId: `${CUSTOMER}-recover`, abnetNumber: CRM, nationalId: DNI, email: EMAIL },
    { baseUrl: BASE, token: TOKEN, fetchImpl: captured.fetchImpl }
  )
  assert.deepEqual(result, { outcome: "linked", iptvId: IPTV, crmId: CRM })
  assert.equal(captured.calls.some((call) => call.path === "/api/sync-client"), false)
  assert.equal(captured.calls.some((call) => call.path === "/api/register-client"), false)
})

test("la vinculación completa guarda el código externo solo si está vacío", async () => {
  const store = customerStore([nievaRow()])
  const result = await associateConfirmedAbnetCustomer(store, {
    companyId: COMPANY,
    customerId: NIEVA,
    abnetNumber: CRM,
    iptvId: NIEVA_ABNET_REPAIR.iptvId,
    crmId: CRM,
    catalog: [nievaCatalog()],
  })
  assert.deepEqual(result, { outcome: "saved", externalCustomerCode: "00006794" })
  assert.equal(store.rows[0].external_customer_code, "00006794")
  assert.deepEqual(store.updates, [{ external_customer_code: "00006794" }])
})

test("una identidad distinta no escribe el código externo", async () => {
  const store = customerStore([nievaRow({ dni: "20999888" })])
  const result = await associateConfirmedAbnetCustomer(store, {
    companyId: COMPANY,
    customerId: NIEVA,
    abnetNumber: CRM,
    iptvId: NIEVA_ABNET_REPAIR.iptvId,
    crmId: CRM,
    catalog: [nievaCatalog()],
  })
  assert.deepEqual(result, { outcome: "partial", reason: "identity" })
  assert.equal(store.updates.length, 0)
  assert.equal(store.rows[0].external_customer_code, null)
})

test("un código externo ocupado no se duplica", async () => {
  const store = customerStore([
    nievaRow(),
    nievaRow({ id: "other-customer", external_customer_code: "6794" }),
  ])
  const result = await associateConfirmedAbnetCustomer(store, {
    companyId: COMPANY,
    customerId: NIEVA,
    abnetNumber: CRM,
    iptvId: NIEVA_ABNET_REPAIR.iptvId,
    crmId: CRM,
    catalog: [nievaCatalog()],
  })
  assert.deepEqual(result, { outcome: "partial", reason: "occupied" })
  assert.equal(store.updates.length, 0)
})

test("si la actualización de Bespoke falla queda una vinculación parcial", async () => {
  const store = customerStore([nievaRow()])
  store.from = () => ({
    select() {
      return this
    },
    eq() {
      return this
    },
    is() {
      return this
    },
    order() {
      return this
    },
    range() {
      return Promise.resolve({ data: [nievaRow()], error: null })
    },
    update() {
      return {
        eq() {
          return this
        },
        is() {
          return this
        },
        or() {
          return this
        },
        select() {
          return Promise.resolve({ data: [], error: { message: "no se escribió" } })
        },
      }
    },
  })
  const result = await associateConfirmedAbnetCustomer(store, {
    companyId: COMPANY,
    customerId: NIEVA,
    abnetNumber: CRM,
    iptvId: NIEVA_ABNET_REPAIR.iptvId,
    crmId: CRM,
    catalog: [nievaCatalog()],
  })
  assert.equal(result.outcome, "partial")
  assert.notEqual(result.outcome, "saved")
})

test("la reparación de Nieva exige la ficha, el id_iptv y un código libre", () => {
  const ready = {
    customerId: NIEVA,
    customerNumber: NIEVA_ABNET_REPAIR.customerNumber,
    nationalId: DNI,
    email: EMAIL,
    currentExternalCode: null,
    holders: [{ id: NIEVA, externalCustomerCode: null }],
    catalog: [nievaCatalog()],
  }
  assert.deepEqual(planNievaAbnetRepair(ready), {
    outcome: "save",
    externalCustomerCode: "00006794",
  })
  assert.equal(
    planNievaAbnetRepair({ ...ready, customerId: CUSTOMER }).reason,
    "customer"
  )
  assert.equal(
    planNievaAbnetRepair({
      ...ready,
      catalog: [nievaCatalog({ id_iptv: 99 })],
    }).reason,
    "identity"
  )
  assert.equal(
    planNievaAbnetRepair({
      ...ready,
      catalog: [nievaCatalog({ id_crm: "1111" })],
    }).reason,
    "identity"
  )
  assert.equal(
    planNievaAbnetRepair({
      ...ready,
      holders: [
        { id: NIEVA, externalCustomerCode: null },
        { id: "other-customer", externalCustomerCode: "00006794" },
      ],
    }).reason,
    "occupied"
  )
  assert.equal(
    planBespokeAbnetAssociation({
      customerId: NIEVA,
      expectedCustomerId: NIEVA,
      abnetNumber: CRM,
      expectedIptvId: NIEVA_ABNET_REPAIR.iptvId,
      expectedCrmId: CRM,
      nationalId: DNI,
      email: EMAIL,
      currentExternalCode: "00001111",
      holders: [{ id: NIEVA, externalCustomerCode: "00001111" }],
      catalog: [nievaCatalog()],
    }).reason,
    "existing_code"
  )
})
