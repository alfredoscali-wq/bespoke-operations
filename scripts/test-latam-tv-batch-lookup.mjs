/**
 * Consulta agrupada de get-clients. No llama a la API real.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  classifyLatamIdentifierBatch,
  readLatamClientsByIdentifiers,
} from "../lib/integrations/latam-tv/client.ts"

const TOKEN = "latam-test-token-do-not-leak"
const BASE = "https://abnetv.cd-latam.com"

test("tres identificadores producen una sola consulta y distinguen el estado", async () => {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    return new Response(
      JSON.stringify({
        code: 1,
        error: false,
        clients: [
          {
            id_iptv: "29",
            id_crm: "6798",
            usuario: "ggerardotoranzo@hotmail.com.ar",
            estado: 1,
            plan_nombre: "Plan Basico",
            password: "must-not-leak",
          },
          {
            id_iptv: "40",
            id_crm: "3959",
            usuario: "suspendido@example.com",
            estado: 0,
            plan_nombre: "Plan Basico",
          },
          {
            id_iptv: "6797",
            estado: 1,
            plan_nombre: "Plan Basico",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }
  const result = await readLatamClientsByIdentifiers(["6798", "3959", "2205"], {
    baseUrl: BASE,
    token: TOKEN,
    fetchImpl,
  })
  assert.equal(calls.length, 1)
  assert.equal(new URL(calls[0].url).pathname, "/api/get-clients")
  assert.equal(calls[0].init.method, "GET")
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    identificador: ["6798", "3959", "2205"],
  })
  assert.equal(result["6798"].phase, "active")
  assert.equal(result["6798"].identifier, "6798")
  assert.equal(result["6798"].planName, "Plan Basico")
  assert.equal(result["3959"].phase, "suspended")
  assert.equal(result["3959"].identifier, "3959")
  assert.equal(result["2205"].phase, "unregistered")
  assert.equal(result["2205"].identifier, null)
  assert.equal(JSON.stringify(result).includes(TOKEN), false)
  assert.equal(JSON.stringify(result).includes("must-not-leak"), false)
  assert.equal(JSON.stringify(calls[0].init.body).includes("id_iptv"), false)
})

test("un cliente identificado solo por id_iptv no coincide con el N° CRM", () => {
  const result = classifyLatamIdentifierBatch(["6798"], {
    code: 1,
    clients: [{ id_iptv: "6798", estado: 1, plan_nombre: "Plan Basico" }],
  })
  assert.equal(result["6798"].phase, "unregistered")
  assert.equal(result["6798"].identifier, null)
})

test("code 3 marca los identificadores pedidos como no registrados", () => {
  const result = classifyLatamIdentifierBatch(["6797", "2205"], {
    code: 3,
    message: "Clientes no registrados",
    noregistrados: ["6797", "2205"],
  })
  assert.equal(result["6797"].phase, "unregistered")
  assert.equal(result["2205"].phase, "unregistered")
})

test("un fallo de transporte deja la página como no disponible", async () => {
  await assert.rejects(
    () =>
      readLatamClientsByIdentifiers(["6798"], {
        baseUrl: BASE,
        token: TOKEN,
        fetchImpl: async () => {
          throw new Error(`failed ${TOKEN}`)
        },
      }),
    (error) => {
      assert.equal(error.kind, "unavailable")
      assert.equal(String(error.message).includes(TOKEN), false)
      return true
    }
  )
  const result = classifyLatamIdentifierBatch(["6798", "3959"], null)
  assert.equal(result["6798"].phase, "unavailable")
  assert.equal(result["3959"].phase, "unavailable")
})
