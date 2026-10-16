/**
 * Contrato del endpoint interno y del diálogo de TV.
 * No llama a LATAM.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { getLatamTvClientByIdentifier } from "../lib/integrations/latam-tv/client.ts"
import { LatamTvRequestError } from "../lib/integrations/latam-tv/errors.ts"
import { latamIdentifierFromCustomer } from "../lib/integrations/latam-tv/identifier.ts"
import { latamLookupUiState } from "../lib/integrations/latam-tv/lookup-state.ts"

const root = resolve(import.meta.dirname, "..")
const TOKEN = "latam-test-token-do-not-leak"
const BASE = "https://abnetv.cd-latam.com"
const CUSTOMER_ID = "30bcf9bb-c703-42a3-9599-0dcdcd4161a3"

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function clientRecord(status) {
  return {
    id_iptv: "91",
    id_crm: "6798",
    usuario: "cliente",
    estado: status,
    plan_nombre: "Plan Basico",
    plan_id: "4",
  }
}

async function internalLookup(body, status = 200) {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    if (status === 0) throw new Error("network")
    return jsonResponse(body, status)
  }
  try {
    const lookup = await getLatamTvClientByIdentifier("00006798", {
      baseUrl: BASE,
      token: TOKEN,
      fetchImpl,
      timeoutMs: status === 0 ? 20 : undefined,
    })
    return {
      httpOk: true,
      body: { success: true, ...lookup },
      calls,
    }
  } catch (error) {
    assert.ok(error instanceof LatamTvRequestError)
    const httpStatus = error.kind === "not_configured" ? 503 : 502
    return {
      httpOk: false,
      body: { success: false, message: error.message },
      httpStatus,
      calls,
    }
  }
}

test("code 3 llega al diálogo como No registrado", async () => {
  const response = await internalLookup({
    error: true,
    code: 3,
    message: "Clientes no registrados",
    noregistrados: ["6798"],
  })
  assert.equal(response.httpOk, true)
  assert.equal(response.body.success, true)
  assert.equal(response.body.found, false)
  assert.equal(response.body.error, undefined)
  const view = latamLookupUiState(response.httpOk, response.body)
  assert.equal(view.phase, "unregistered")
  assert.equal(view.label, "LATAM: No registrado")
  assert.deepEqual(JSON.parse(response.calls[0].init.body), { identificador: ["6798"] })
  assert.equal(response.calls[0].init.method, "GET")
  assert.equal(new URL(response.calls[0].url).pathname, "/api/get-clients")
  assert.equal(JSON.stringify(response.body).includes(CUSTOMER_ID), false)
  assert.equal(JSON.stringify(response.calls[0].init.body).includes("CLI-"), false)
  assert.equal(JSON.stringify(response.body).includes(TOKEN), false)
})

test("cliente activo y suspendido conservan su estado", async () => {
  const active = await internalLookup({ code: 1, clients: [clientRecord(1)] })
  assert.equal(latamLookupUiState(true, active.body).label, "LATAM: Activo")
  const suspended = await internalLookup({ code: 1, clients: [clientRecord(0)] })
  assert.equal(latamLookupUiState(true, suspended.body).label, "LATAM: Suspendido")
})

test("timeout, HTTP 500, 401 y JSON inválido son No disponible", async () => {
  const timeout = await getLatamTvClientByIdentifier("6798", {
    baseUrl: BASE,
    token: TOKEN,
    timeoutMs: 20,
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(init.signal.reason))
      }),
  }).then(
    () => null,
    (error) => error
  )
  assert.ok(timeout instanceof LatamTvRequestError)
  assert.equal(
    latamLookupUiState(false, { success: false, message: timeout.message }).label,
    "LATAM: No disponible"
  )
  for (const status of [500, 401, 403]) {
    const failed = await internalLookup({ message: "denied" }, status)
    assert.equal(failed.httpOk, false)
    assert.equal(latamLookupUiState(false, failed.body).label, "LATAM: No disponible")
  }
  assert.equal(latamLookupUiState(true, null).label, "LATAM: No disponible")
  assert.equal(
    latamLookupUiState(false, { success: false, message: "La consulta de LATAM TV no está disponible." })
      .label,
    "LATAM: No disponible"
  )
})

test("found false no se convierte en error y el 404 de Bespoke sigue siendo otro caso", () => {
  assert.equal(
    latamLookupUiState(true, { success: true, found: false }).phase,
    "unregistered"
  )
  assert.equal(
    latamLookupUiState(false, { success: false, message: "Cliente no encontrado." }).phase,
    "unavailable"
  )
  const route = read("app/api/integrations/latam-tv/customers/[customerId]/route.ts")
  const dialog = read("components/subscriptions/latam-tv-row-dialog.tsx")
  assert.match(route, /NextResponse\.json\(\{ success: true, \.\.\.identity \}\)/)
  assert.match(route, /listLatamTvClients/)
  assert.doesNotMatch(route, /getLatamTvClientByIdentifier/)
  assert.doesNotMatch(route, /external_customer_code/)
  assert.doesNotMatch(route, /found:\s*false[\s\S]{0,80}404/)
  assert.match(dialog, /latamLookupUiState\(response\.ok, payload\)/)
  assert.equal(
    latamIdentifierFromCustomer(
      {
        companyId: "00000000-0000-4000-8000-000000000002",
        externalCustomerCode: "00006798",
      },
      "00000000-0000-4000-8000-000000000002"
    ).identifier,
    "6798"
  )
  assert.equal(
    latamIdentifierFromCustomer(
      { companyId: "company-a", externalCustomerCode: "CLI-005779" },
      "company-a"
    ).status,
    "missing_identifier"
  )
})
