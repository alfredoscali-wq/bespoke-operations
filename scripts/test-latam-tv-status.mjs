/**
 * Suspensión y activación LATAM. No llama a la API real.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { disableClient, enableClient } from "../lib/integrations/latam-tv/client.ts"
import { LatamTvRequestError } from "../lib/integrations/latam-tv/errors.ts"
import { latamIdentifierFromCustomer } from "../lib/integrations/latam-tv/identifier.ts"

const root = resolve(import.meta.dirname, "..")
const TOKEN = "latam-status-token-do-not-leak"
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

function foundClient(identifier, status) {
  return {
    code: 1,
    clients: [
      {
        id_crm: identifier,
        usuario: "cliente@email.com",
        status,
        token: TOKEN,
        id_plan: "99",
      },
    ],
  }
}

async function run(action, identifier, handler) {
  const calls = []
  const fn = action === "disable" ? disableClient : enableClient
  const result = await fn(identifier, {
    baseUrl: BASE,
    token: TOKEN,
    fetchImpl: async (url, init) => {
      const endpoint = new URL(url)
      const body = JSON.parse(init.body)
      calls.push({ path: endpoint.pathname, body })
      assert.equal(endpoint.searchParams.get("token"), TOKEN)
      return handler(endpoint.pathname, calls)
    },
  })
  return { result, calls }
}

function assertIdentifierOnly(body) {
  assert.deepEqual(Object.keys(body).sort(), ["identificador"])
  assert.equal("id_plan" in body, false)
}

test("1 y 4. un cliente activo se suspende y el estado sale de la nueva consulta", async () => {
  let lookups = 0
  const { result, calls } = await run("disable", "3301", (path) => {
    if (path === "/api/get-clients") {
      lookups += 1
      return jsonResponse(foundClient("3301", lookups === 1 ? 1 : 0))
    }
    if (path === "/api/disable-client") return jsonResponse({ code: 1, token: TOKEN })
    throw new Error(path)
  })
  assert.equal(result.outcome, "updated")
  assert.equal(result.status, "disabled")
  assert.equal(JSON.stringify(result).includes(TOKEN), false)
  assert.deepEqual(
    calls.map((call) => call.path),
    ["/api/get-clients", "/api/disable-client", "/api/get-clients"]
  )
  assertIdentifierOnly(calls[1].body)
})

test("2. un cliente suspendido no vuelve a suspenderse", async () => {
  const { result, calls } = await run("disable", "3302", (path) => {
    if (path === "/api/get-clients") return jsonResponse(foundClient("3302", 0))
    throw new Error(path)
  })
  assert.equal(result.outcome, "mismatch")
  assert.equal(result.status, "disabled")
  assert.deepEqual(
    calls.map((call) => call.path),
    ["/api/get-clients"]
  )
})

test("3. si no existe, no se llama a disable-client", async () => {
  const { result, calls } = await run("disable", "3303", (path) => {
    if (path === "/api/get-clients") return jsonResponse({ code: 3 })
    throw new Error(path)
  })
  assert.equal(result.outcome, "not_found")
  assert.match(result.message, /no existe en LATAM TV/)
  assert.deepEqual(
    calls.map((call) => call.path),
    ["/api/get-clients"]
  )
})

test("5. code 3 de disable-client no modifica nada", async () => {
  const { result, calls } = await run("disable", "3304", (path) => {
    if (path === "/api/get-clients") return jsonResponse(foundClient("3304", 1))
    if (path === "/api/disable-client") return jsonResponse({ code: 3, token: TOKEN })
    throw new Error(path)
  })
  assert.equal(result.outcome, "not_found")
  assert.match(result.message, /No se realizó ninguna modificación/)
  assert.equal(result.message.includes(TOKEN), false)
  assert.deepEqual(
    calls.map((call) => call.path),
    ["/api/get-clients", "/api/disable-client"]
  )
})

test("6. un HTTP de error al suspender no expone el token", async () => {
  await assert.rejects(
    () =>
      disableClient("3305", {
        baseUrl: BASE,
        token: TOKEN,
        fetchImpl: async (url) => {
          const path = new URL(url).pathname
          if (path === "/api/get-clients") return jsonResponse(foundClient("3305", 1))
          return jsonResponse({ token: TOKEN }, 500)
        },
      }),
    (error) => {
      assert.ok(error instanceof LatamTvRequestError)
      assert.equal(error.kind, "unavailable")
      assert.equal(error.message.includes(TOKEN), false)
      return true
    }
  )
})

test("7. un timeout al suspender no expone el token ni la URL", async () => {
  await assert.rejects(
    () =>
      disableClient("3306", {
        baseUrl: BASE,
        token: TOKEN,
        fetchImpl: async (url) => {
          const path = new URL(url).pathname
          if (path === "/api/get-clients") return jsonResponse(foundClient("3306", 1))
          throw new Error(`timeout ${TOKEN} ${url}`)
        },
      }),
    (error) => {
      assert.ok(error instanceof LatamTvRequestError)
      assert.equal(error.message.includes(TOKEN), false)
      assert.equal(error.message.includes("http"), false)
      return true
    }
  )
})

test("8 y 11. un cliente suspendido se activa sin enviar el plan", async () => {
  let lookups = 0
  const { result, calls } = await run("enable", "3307", (path) => {
    if (path === "/api/get-clients") {
      lookups += 1
      return jsonResponse(foundClient("3307", lookups === 1 ? 0 : 1))
    }
    if (path === "/api/enable-client") return jsonResponse({ code: 1 })
    throw new Error(path)
  })
  assert.equal(result.outcome, "updated")
  assert.equal(result.status, "enabled")
  assert.deepEqual(
    calls.map((call) => call.path),
    ["/api/get-clients", "/api/enable-client", "/api/get-clients"]
  )
  assertIdentifierOnly(calls[1].body)
})

test("9. un cliente activo no se vuelve a activar", async () => {
  const { result, calls } = await run("enable", "3308", (path) => {
    if (path === "/api/get-clients") return jsonResponse(foundClient("3308", 1))
    throw new Error(path)
  })
  assert.equal(result.outcome, "mismatch")
  assert.equal(result.status, "enabled")
  assert.deepEqual(
    calls.map((call) => call.path),
    ["/api/get-clients"]
  )
})

test("10. si no existe, no se llama a enable-client", async () => {
  const { result, calls } = await run("enable", "3309", (path) => {
    if (path === "/api/get-clients") return jsonResponse({ code: 3 })
    throw new Error(path)
  })
  assert.equal(result.outcome, "not_found")
  assert.deepEqual(
    calls.map((call) => call.path),
    ["/api/get-clients"]
  )
})

test("12. code 3 de enable-client no modifica nada", async () => {
  const { result, calls } = await run("enable", "3310", (path) => {
    if (path === "/api/get-clients") return jsonResponse(foundClient("3310", 0))
    if (path === "/api/enable-client") return jsonResponse({ code: 3 })
    throw new Error(path)
  })
  assert.equal(result.outcome, "not_found")
  assert.match(result.message, /No se realizó ninguna modificación/)
  assert.equal(calls.at(-1)?.path, "/api/enable-client")
})

test("13. code 2 de enable-client es un error y no cambia Bespoke", async () => {
  const { result } = await run("enable", "3311", (path) => {
    if (path === "/api/get-clients") return jsonResponse(foundClient("3311", 0))
    if (path === "/api/enable-client") return jsonResponse({ code: 2, token: TOKEN })
    throw new Error(path)
  })
  assert.equal(result.outcome, "rejected")
  assert.match(result.message, /No se realizaron cambios en Bespoke/)
  assert.equal(result.message.includes(TOKEN), false)
})

test("14. un HTTP de error al activar no expone el token", async () => {
  await assert.rejects(
    () =>
      enableClient("3312", {
        baseUrl: BASE,
        token: TOKEN,
        fetchImpl: async (url) => {
          const path = new URL(url).pathname
          if (path === "/api/get-clients") return jsonResponse(foundClient("3312", 0))
          return jsonResponse({ token: TOKEN }, 502)
        },
      }),
    (error) => error instanceof LatamTvRequestError && error.message.includes(TOKEN) === false
  )
})

test("15. un error de red al activar no expone el token", async () => {
  await assert.rejects(
    () =>
      enableClient("3313", {
        baseUrl: BASE,
        token: TOKEN,
        fetchImpl: async (url) => {
          const path = new URL(url).pathname
          if (path === "/api/get-clients") return jsonResponse(foundClient("3313", 0))
          throw new Error(`reset ${TOKEN} ${url}`)
        },
      }),
    (error) => {
      assert.ok(error instanceof LatamTvRequestError)
      assert.equal(error.message.includes(TOKEN), false)
      return true
    }
  )
})

test("18. un segundo envío simultáneo no vuelve a llamar a LATAM", async () => {
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  const calls = []
  const deps = {
    baseUrl: BASE,
    token: TOKEN,
    fetchImpl: async (url, init) => {
      const path = new URL(url).pathname
      calls.push(path)
      if (path === "/api/get-clients") {
        await gate
        return jsonResponse(foundClient("3314", calls.filter((item) => item === "/api/get-clients").length === 1 ? 1 : 0))
      }
      if (path === "/api/disable-client") {
        assertIdentifierOnly(JSON.parse(init.body))
        return jsonResponse({ code: 1 })
      }
      throw new Error(path)
    },
  }
  const first = disableClient("3314", deps)
  await new Promise((resolve) => setImmediate(resolve))
  const second = await enableClient("3314", deps)
  assert.equal(second.outcome, "busy")
  release()
  assert.equal((await first).outcome, "updated")
  assert.equal((await first).status, "disabled")
  assert.deepEqual(calls, ["/api/get-clients", "/api/disable-client", "/api/get-clients"])
})

test("16-17 y 19-21. el tenant, el plan y el resto de operaciones quedan fuera", () => {
  assert.deepEqual(
    latamIdentifierFromCustomer(
      { companyId: "otra-empresa", externalCustomerCode: "00003301" },
      "empresa-actual"
    ),
    { status: "not_found" }
  )
  const client = read("lib/integrations/latam-tv/client.ts")
  const route = read("app/api/integrations/latam-tv/customers/[customerId]/status/route.ts")
  const dialog = read("components/subscriptions/latam-tv-row-dialog.tsx")
  const audit = read("lib/integrations/latam-tv/password-audit.ts")
  assert.doesNotMatch(client, /id_plan/)
  assert.doesNotMatch(client, /console\./)
  assert.match(route, /requireSubscriptionsWriteContext/)
  assert.match(route, /\.eq\("company_id", auth\.companyId\)/)
  assert.match(route, /disableClient/)
  assert.match(route, /enableClient/)
  assert.match(route, /"id_plan" in record/)
  assert.doesNotMatch(route, /modify-client|delete-client|register-client|modify-password/)
  assert.match(dialog, /Suspender cliente en LATAM TV/)
  assert.match(dialog, /Esta acción no elimina al cliente ni modifica su plan\./)
  assert.match(dialog, /Activar cliente en LATAM TV/)
  assert.match(dialog, /Su plan actual no será modificado\./)
  assert.match(dialog, /JSON\.stringify\(\{ action \}\)/)
  assert.doesNotMatch(dialog, /id_plan/)
  assert.doesNotMatch(dialog, /\/api\/disable-client/)
  assert.doesNotMatch(dialog, /\/api\/enable-client/)
  assert.doesNotMatch(dialog, /localStorage/)
  assert.match(audit, /disable_client/)
  assert.match(audit, /enable_client/)
  assert.match(audit, /change_password/)
})
