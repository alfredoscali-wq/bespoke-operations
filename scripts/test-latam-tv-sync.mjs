/**
 * Sincronización LATAM. No llama a la API real.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  latamSyncClientBody,
  readLatamClientLink,
  syncLatamTvClient,
} from "../lib/integrations/latam-tv/client.ts"
import { LatamTvRequestError } from "../lib/integrations/latam-tv/errors.ts"

const TOKEN = "latam-sync-token-do-not-leak"
const BASE = "https://abnetv.cd-latam.com"

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function capture(responseBody, status = 200) {
  const calls = []
  return {
    calls,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), method: init?.method, body: String(init?.body ?? "") })
      return jsonResponse(responseBody, status)
    },
  }
}

test("el body usa id_iptv 29 e id_crm 6798", () => {
  assert.deepEqual(latamSyncClientBody({ idIptv: "29", idCrm: "00006798" }), {
    id_iptv: "29",
    id_crm: "6798",
  })
  assert.notEqual(latamSyncClientBody({ idIptv: "29", idCrm: "6798" }).id_iptv, "6798")
})

test("6798 no se envía como id_iptv", () => {
  assert.throws(
    () => latamSyncClientBody({ idIptv: "6798", idCrm: "6798" }),
    (error) => error instanceof LatamTvRequestError && error.kind === "invalid_identifier"
  )
  assert.throws(
    () => latamSyncClientBody({ idIptv: "00006798", idCrm: "6798" }),
    (error) => error instanceof LatamTvRequestError
  )
})

test("code 1 es sincronización exitosa y una sola llamada", async () => {
  const captured = capture({ error: false, code: 1 })
  const result = await syncLatamTvClient(
    { idIptv: "29", idCrm: "6798" },
    { baseUrl: BASE, token: TOKEN, fetchImpl: captured.fetchImpl }
  )
  assert.equal(result.outcome, "updated")
  assert.equal(result.code, 1)
  assert.equal(captured.calls.length, 1)
  assert.equal(captured.calls[0].method, "POST")
  assert.equal(new URL(captured.calls[0].url).pathname, "/api/sync-client")
  assert.deepEqual(JSON.parse(captured.calls[0].body), { id_iptv: "29", id_crm: "6798" })
  assert.equal(JSON.stringify(result).includes(TOKEN), false)
  assert.equal(captured.calls[0].body.includes("6798") && captured.calls[0].body.includes('"id_iptv":"29"'), true)
})

for (const [code, outcome] of [
  [3, "iptv_not_found"],
  [4, "crm_already_registered"],
  [5, "update_failed"],
]) {
  test(`code ${code} no dispara otra operación`, async () => {
    const captured = capture({ error: true, code })
    const result = await syncLatamTvClient(
      { idIptv: "29", idCrm: "6798" },
      { baseUrl: BASE, token: TOKEN, fetchImpl: captured.fetchImpl }
    )
    assert.equal(result.outcome, outcome)
    assert.equal(result.code, code)
    assert.equal(captured.calls.length, 1)
    assert.equal(captured.calls[0].url.includes("modify-client"), false)
    assert.equal(captured.calls[0].url.includes("register-client"), false)
    assert.equal(captured.calls[0].url.includes("disable-client"), false)
    assert.equal(captured.calls[0].url.includes("enable-client"), false)
    assert.equal(captured.calls[0].url.includes("modify-password"), false)
  })
}

test("una respuesta sin code no se reintenta", async () => {
  const captured = capture({ error: 404 })
  const result = await syncLatamTvClient(
    { idIptv: "29", idCrm: "6798" },
    { baseUrl: BASE, token: TOKEN, fetchImpl: captured.fetchImpl }
  )
  assert.equal(result.outcome, "rejected")
  assert.equal(result.code, null)
  assert.equal(result.error, 404)
  assert.equal(captured.calls.length, 1)
  assert.deepEqual(JSON.parse(captured.calls[0].body), { id_iptv: "29", id_crm: "6798" })
})

test("la reconsulta lee id_crm y no el primer id_iptv del padrón", async () => {
  const captured = capture({
    code: 1,
    clients: [
      { id_iptv: "1", id_crm: null, identificador: "6798" },
      { id_iptv: "29", id_crm: "6798" },
    ],
  })
  const result = await readLatamClientLink("6798", {
    baseUrl: BASE,
    token: TOKEN,
    fetchImpl: captured.fetchImpl,
  })
  assert.equal(captured.calls.length, 1)
  assert.equal(captured.calls[0].method, "GET")
  assert.deepEqual(JSON.parse(captured.calls[0].body), { identificador: ["6798"] })
  assert.equal(result.iptvId, "29")
  assert.equal(result.crmId, "6798")
  assert.equal(JSON.stringify(result).includes(TOKEN), false)
})
