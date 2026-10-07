/**
 * Cliente LATAM TV de solo lectura. No llama a la API real.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { getLatamTvClientByIdentifier } from "../lib/integrations/latam-tv/client.ts"
import { LatamTvRequestError } from "../lib/integrations/latam-tv/errors.ts"
import { latamIdentifierFromCustomer } from "../lib/integrations/latam-tv/identifier.ts"

const root = resolve(import.meta.dirname, "..")
const TOKEN = "latam-test-token-do-not-leak"
const BASE = "https://abnetv.cd-latam.com"

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function clientRecord(overrides = {}) {
  return {
    id_iptv: "91",
    id_crm: "2205",
    identificador: "2205",
    usuario: "camaduro",
    dni: "30111222",
    status: 1,
    nombre: "Arturo",
    apellido: "Camaduro",
    direccion: "Calle 1",
    telefono: "351000",
    cantidad_dispositivos: 2,
    fecha_creacion: "2024-01-02",
    fecha_modificacion: "2024-06-03",
    plan_name: "TV Full",
    plan_id: "9",
    macs: ["AA:BB:CC:DD:EE:FF"],
    password: "must-not-leak",
    token: TOKEN,
    ...overrides,
  }
}

async function lookup(body, options = {}) {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    if (options.invalidJson) return new Response("no-es-json", { status: 200 })
    if (options.network) throw new Error(`failed ${TOKEN} ${url}`)
    return jsonResponse(body, options.status ?? 200)
  }
  const result = await getLatamTvClientByIdentifier(options.identifier ?? "2205", {
    baseUrl: options.baseUrl ?? BASE,
    token: options.token ?? TOKEN,
    fetchImpl,
  })
  return { result, calls }
}

test("1. identificador válido devuelve el cliente sin secretos", async () => {
  const { result, calls } = await lookup({ code: 1, clients: [clientRecord()] })
  assert.equal(result.found, true)
  if (!result.found) return
  assert.equal(result.client.identifier, "2205")
  assert.equal(result.client.username, "camaduro")
  assert.equal(result.client.iptvId, "91")
  assert.equal(result.client.plan?.name, "TV Full")
  assert.equal(result.client.plan?.id, "9")
  assert.deepEqual(result.client.macs, ["AA:BB:CC:DD:EE:FF"])
  assert.equal(JSON.stringify(result).includes(TOKEN), false)
  assert.equal(JSON.stringify(result).includes("must-not-leak"), false)
  assert.equal(calls.length, 1)
  const url = new URL(calls[0].url)
  assert.equal(url.origin, BASE)
  assert.equal(url.pathname, "/api/get-clients")
  assert.equal(url.searchParams.get("token"), TOKEN)
  assert.equal(calls[0].init.method, "POST")
  assert.deepEqual(JSON.parse(calls[0].init.body), { identificador: ["2205"] })
})

test("2. code 3 es cliente no encontrado", async () => {
  const { result } = await lookup({ code: 3, clients: [] })
  assert.deepEqual(result, { found: false })
})

test("3. code 2 es un error controlado", async () => {
  await assert.rejects(
    () => lookup({ code: 2, message: `fallo ${TOKEN}` }),
    (error) => {
      assert.ok(error instanceof LatamTvRequestError)
      assert.equal(error.kind, "unavailable")
      assert.equal(error.message.includes(TOKEN), false)
      return true
    }
  )
})

test("4. HTTP no OK no expone el cuerpo ni el token", async () => {
  await assert.rejects(
    () => lookup(`secret ${TOKEN}`, { status: 500 }),
    (error) => {
      assert.ok(error instanceof LatamTvRequestError)
      assert.equal(error.message.includes(TOKEN), false)
      assert.equal(error.message.includes("secret"), false)
      return true
    }
  )
})

test("5. JSON inválido es un error controlado", async () => {
  await assert.rejects(
    () => lookup(null, { invalidJson: true }),
    (error) => error instanceof LatamTvRequestError && error.kind === "unavailable"
  )
})

test("6. identificador vacío no llama a LATAM", async () => {
  let called = false
  await assert.rejects(
    () =>
      getLatamTvClientByIdentifier("  ", {
        baseUrl: BASE,
        token: TOKEN,
        fetchImpl: async () => {
          called = true
          return jsonResponse({ code: 1 })
        },
      }),
    (error) => error instanceof LatamTvRequestError && error.kind === "invalid_identifier"
  )
  assert.equal(called, false)
})

test("7. status 1 queda habilitado", async () => {
  const { result } = await lookup({
    code: 1,
    clients: [clientRecord({ status: 1 })],
  })
  assert.equal(result.found, true)
  if (result.found) assert.equal(result.client.status, "enabled")
})

test("8. status 0 queda deshabilitado", async () => {
  const { result } = await lookup({
    code: 1,
    clients: [clientRecord({ status: "0" })],
  })
  assert.equal(result.found, true)
  if (result.found) assert.equal(result.client.status, "disabled")
})

test("9. un error de red no incluye el token ni la URL", async () => {
  await assert.rejects(
    () => lookup(null, { network: true }),
    (error) => {
      assert.ok(error instanceof LatamTvRequestError)
      assert.equal(error.message.includes(TOKEN), false)
      assert.equal(error.message.includes("abnetv"), false)
      return true
    }
  )
})

test("10. la consulta sigue en get-clients y el script manual no da de alta", () => {
  const source = read("lib/integrations/latam-tv/client.ts")
  const route = read(
    "app/api/integrations/latam-tv/customers/[customerId]/route.ts"
  )
  const script = read("scripts/latam-tv-get-client.mjs")
  for (const file of [route, script]) {
    assert.doesNotMatch(file, /register-client/)
    assert.doesNotMatch(file, /delete-client/)
    assert.doesNotMatch(file, /disable-client/)
    assert.doesNotMatch(file, /enable-client/)
    assert.doesNotMatch(file, /modify-client/)
    assert.doesNotMatch(file, /modify-password/)
    assert.doesNotMatch(file, /NEXT_PUBLIC_LATAM/)
  }
  assert.match(source, /\/api\/get-clients/)
  assert.match(source, /\/api\/get-plans/)
  assert.match(source, /\/api\/register-client/)
  assert.match(source, /\/api\/modify-password/)
  assert.match(source, /\/api\/disable-client/)
  assert.match(source, /\/api\/enable-client/)
  assert.match(source, /\/api\/modify-client/)
  assert.doesNotMatch(script, /get-plans/)
  assert.doesNotMatch(source, /\/api\/delete-client/)
  assert.doesNotMatch(source, /NEXT_PUBLIC_LATAM/)
  assert.match(source, /method: "POST"/)
  assert.match(route, /auth\.companyId/)
  assert.match(route, /requireSubscriptionsReadContext/)
  assert.doesNotMatch(route, /searchParams\.get\("token"\)/)
  assert.equal(source.includes(TOKEN), false)
})

test("un cliente de otra empresa no se consulta", () => {
  assert.deepEqual(
    latamIdentifierFromCustomer(
      { companyId: "company-b", externalCustomerCode: "00002205" },
      "company-a"
    ),
    { status: "not_found" }
  )
  assert.deepEqual(
    latamIdentifierFromCustomer(
      {
        companyId: "company-a",
        externalCustomerCode: "00002205",
        deletedAt: "2026-01-01",
      },
      "company-a"
    ),
    { status: "not_found" }
  )
  assert.equal(
    latamIdentifierFromCustomer(
      { companyId: "company-a", externalCustomerCode: "00002205" },
      "company-a"
    ).status,
    "ready"
  )
})

test("code 1 de otro identificador no se devuelve como encontrado", async () => {
  const { result } = await lookup({
    code: 1,
    clients: [clientRecord({ id_crm: "9999", identificador: "9999" })],
  })
  assert.deepEqual(result, { found: false })
})
