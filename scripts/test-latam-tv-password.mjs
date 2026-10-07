/**
 * Cambio de clave LATAM. No llama a la API real.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { modifyClientPassword } from "../lib/integrations/latam-tv/client.ts"
import { LatamTvRequestError } from "../lib/integrations/latam-tv/errors.ts"
import { latamIdentifierFromCustomer } from "../lib/integrations/latam-tv/identifier.ts"
import {
  latamPasswordsMatch,
  validateLatamTvPassword,
} from "../lib/integrations/latam-tv/password.ts"

const root = resolve(import.meta.dirname, "..")
const TOKEN = "latam-password-token-do-not-leak"
const BASE = "https://abnetv.cd-latam.com"
const PASSWORD = "clave1234"

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function foundClient(identifier, status = 1) {
  return {
    code: 1,
    clients: [
      {
        id_crm: identifier,
        usuario: "cliente@email.com",
        status,
        password: PASSWORD,
        token: TOKEN,
      },
    ],
  }
}

async function changePassword(identifier, password, handler) {
  const calls = []
  const result = await modifyClientPassword(identifier, password, {
    baseUrl: BASE,
    token: TOKEN,
    fetchImpl: async (url, init) => {
      const endpoint = new URL(url)
      calls.push({ path: endpoint.pathname, body: JSON.parse(init.body) })
      assert.equal(endpoint.searchParams.get("token"), TOKEN)
      return handler(endpoint.pathname, calls)
    },
  })
  return { result, calls }
}

test("1-5. la contraseña exige entre 4 y 10 caracteres y ambas deben coincidir", () => {
  assert.equal(validateLatamTvPassword(PASSWORD), null)
  assert.equal(validateLatamTvPassword("abcd"), null)
  assert.equal(validateLatamTvPassword("1234567890"), null)
  assert.match(validateLatamTvPassword("abc") ?? "", /4 y 10/)
  assert.match(validateLatamTvPassword("12345678901") ?? "", /4 y 10/)
  assert.match(validateLatamTvPassword("") ?? "", /obligatoria/)
  assert.equal(latamPasswordsMatch("abcd", "abcd"), true)
  assert.equal(latamPasswordsMatch("abcd", "abce"), false)
})

test("6. un identificador vacío no llama a LATAM", async () => {
  const calls = []
  await assert.rejects(
    () =>
      modifyClientPassword("", PASSWORD, {
        baseUrl: BASE,
        token: TOKEN,
        fetchImpl: async () => {
          calls.push("called")
          return jsonResponse({ code: 1 })
        },
      }),
    (error) => error instanceof LatamTvRequestError && error.kind === "invalid_identifier"
  )
  assert.deepEqual(calls, [])
})

test("7-8. contraseñas inválidas no llaman a LATAM", async () => {
  for (const password of ["abc", "12345678901"]) {
    const { calls, result } = await changePassword("2205", password, () => {
      throw new Error("no debía llamar")
    })
    assert.equal(result.outcome, "invalid")
    assert.deepEqual(calls, [])
  }
})

test("9. cliente existente y code 1 cambia solo la contraseña", async () => {
  const { result, calls } = await changePassword("2205", PASSWORD, (path) => {
    if (path === "/api/get-clients") return jsonResponse(foundClient("2205", 1))
    if (path === "/api/modify-password") return jsonResponse({ code: 1, password: PASSWORD, token: TOKEN })
    throw new Error(path)
  })
  assert.equal(result.outcome, "changed")
  assert.equal(JSON.stringify(result).includes(PASSWORD), false)
  assert.equal(JSON.stringify(result).includes(TOKEN), false)
  assert.deepEqual(
    calls.map((call) => call.path),
    ["/api/get-clients", "/api/modify-password"]
  )
  assert.equal(calls[1].body.identificador, "2205")
  assert.equal(calls[1].body.password, PASSWORD)
})

test("10. si la validación previa no encuentra al cliente, no se cambia la clave", async () => {
  const { result, calls } = await changePassword("2206", PASSWORD, (path) => {
    if (path === "/api/get-clients") return jsonResponse({ code: 3 })
    throw new Error(path)
  })
  assert.equal(result.outcome, "not_found")
  assert.match(result.message, /ya no existe en LATAM TV/)
  assert.deepEqual(
    calls.map((call) => call.path),
    ["/api/get-clients"]
  )
})

test("11. code 3 de modify-password informa que el cliente no existe", async () => {
  const { result, calls } = await changePassword("2207", PASSWORD, (path) => {
    if (path === "/api/get-clients") return jsonResponse(foundClient("2207"))
    if (path === "/api/modify-password") return jsonResponse({ code: 3 })
    throw new Error(path)
  })
  assert.equal(result.outcome, "not_found")
  assert.match(result.message, /no existe en LATAM TV/)
  assert.equal(calls.at(-1)?.path, "/api/modify-password")
})

test("12. code 2 no modifica Bespoke", async () => {
  const { result } = await changePassword("2208", PASSWORD, (path) => {
    if (path === "/api/get-clients") return jsonResponse(foundClient("2208"))
    if (path === "/api/modify-password") return jsonResponse({ code: 2, token: TOKEN })
    throw new Error(path)
  })
  assert.equal(result.outcome, "rejected")
  assert.match(result.message, /No se realizaron cambios en Bespoke/)
  assert.equal(result.message.includes(TOKEN), false)
})

test("13. un HTTP de error no expone token ni contraseña", async () => {
  await assert.rejects(
    () =>
      modifyClientPassword("2209", PASSWORD, {
        baseUrl: BASE,
        token: TOKEN,
        fetchImpl: async (url) => {
            const path = new URL(url).pathname
            if (path === "/api/get-clients") return jsonResponse(foundClient("2209"))
            return jsonResponse({ token: TOKEN, password: PASSWORD }, 500)
        },
      }),
    (error) => {
      assert.ok(error instanceof LatamTvRequestError)
      assert.equal(error.kind, "unavailable")
      assert.equal(error.message.includes(TOKEN), false)
      assert.equal(error.message.includes(PASSWORD), false)
      return true
    }
  )
})

test("14. un error de red o timeout usa el mismo corte, sin secretos", async () => {
  await assert.rejects(
    () =>
      modifyClientPassword("2210", PASSWORD, {
        baseUrl: BASE,
        token: TOKEN,
        fetchImpl: async (url) => {
          const path = new URL(url).pathname
          if (path === "/api/get-clients") return jsonResponse(foundClient("2210"))
          throw new Error(`timeout ${TOKEN} ${PASSWORD} ${url}`)
        },
      }),
    (error) => {
      assert.ok(error instanceof LatamTvRequestError)
      assert.equal(error.message.includes(TOKEN), false)
      assert.equal(error.message.includes(PASSWORD), false)
      assert.equal(error.message.includes("http"), false)
      return true
    }
  )
})

test("15. un cliente suspendido cambia la clave y no se reactiva", async () => {
  const { result, calls } = await changePassword("2211", PASSWORD, (path) => {
    if (path === "/api/get-clients") return jsonResponse(foundClient("2211", 0))
    if (path === "/api/modify-password") return jsonResponse({ code: 1 })
    throw new Error(path)
  })
  assert.equal(result.outcome, "changed")
  assert.deepEqual(
    calls.map((call) => call.path),
    ["/api/get-clients", "/api/modify-password"]
  )
})

test("16. un segundo envío simultáneo no vuelve a llamar a LATAM", async () => {
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
        return jsonResponse(foundClient("2212"))
      }
      if (path === "/api/modify-password") {
        assert.equal(JSON.parse(init.body).password, PASSWORD)
        return jsonResponse({ code: 1 })
      }
      throw new Error(path)
    },
  }
  const first = modifyClientPassword("2212", PASSWORD, deps)
  await new Promise((resolve) => setImmediate(resolve))
  const second = await modifyClientPassword("2212", "otra1234", deps)
  assert.equal(second.outcome, "busy")
  release()
  assert.equal((await first).outcome, "changed")
  assert.deepEqual(calls, ["/api/get-clients", "/api/modify-password"])
})

test("17. el tenant se resuelve en Bespoke y la clave no queda en la respuesta ni en auditoría", () => {
  assert.deepEqual(
    latamIdentifierFromCustomer(
      { companyId: "otra-empresa", externalCustomerCode: "00002205" },
      "empresa-actual"
    ),
    { status: "not_found" }
  )
  const route = read("app/api/integrations/latam-tv/customers/[customerId]/password/route.ts")
  const dialog = read("components/subscriptions/latam-tv-row-dialog.tsx")
  const audit = read("lib/integrations/latam-tv/password-audit.ts")
  assert.match(route, /requireSubscriptionsWriteContext/)
  assert.match(route, /\.eq\("company_id", auth\.companyId\)/)
  assert.match(route, /modifyClientPassword/)
  assert.doesNotMatch(route, /enable-client|disable-client|register-client|delete-client|modify-client/)
  assert.equal(route.includes(PASSWORD), false)
  assert.equal(route.includes(TOKEN), false)
  assert.match(route, /No fue posible comunicarse con LATAM TV/)
  assert.match(dialog, /Confirmar cambio/)
  assert.match(dialog, /Esta acción modifica únicamente la contraseña de LATAM TV\./)
  assert.match(dialog, /busy\.current/)
  assert.doesNotMatch(dialog, /localStorage/)
  assert.doesNotMatch(dialog, /\/api\/modify-password/)
  assert.doesNotMatch(dialog, /enable-client|disable-client|register-client|delete-client/)
  assert.match(audit, /change_password/)
  assert.doesNotMatch(audit, /password:/)
  assert.doesNotMatch(audit, /LATAM_TV_API_TOKEN|searchParams/)
  const client = read("lib/integrations/latam-tv/client.ts")
  assert.doesNotMatch(client, /console\./)
  assert.doesNotMatch(route, /console\.(log|info|debug|warn|error)\([^)]*input\.password/)
  assert.doesNotMatch(route, /localStorage|sessionStorage/)
  assert.doesNotMatch(dialog, /localStorage|sessionStorage/)
})
