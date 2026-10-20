/**
 * Alta Latam simulada. No llama a la API real ni escribe en Supabase.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  refreshLatamSignupByNumber,
  signUpLatamTvClient,
} from "../lib/integrations/latam-tv/client.ts"
import {
  createLatamSignupAttemptStore,
  latamIptvId,
  latamSignupVisibleLabel,
} from "../lib/integrations/latam-tv/signup-attempt.ts"
import {
  assessLatamSignup,
  latamRegisterRejectionMessage,
} from "../lib/integrations/latam-tv/signup.ts"
import { padronLatamMode } from "../lib/subscriptions/padron-latam-mode.ts"

const TOKEN = "latam-stage3-token"
const BASE = "https://abnetv.cd-latam.com"

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function bodyFor(identifier = "6797") {
  const assessment = assessLatamSignup({
    name: "Ada Lovelace",
    dni: "30.123.456",
    email: "cliente@email.com",
    phone: "3515551234",
    address: "Calle 10",
    identifier,
    tvKind: "basica",
    planId: "latam-plan-99",
  })
  assert.equal(assessment.ready, true)
  if (!assessment.ready) throw new Error("alta no lista")
  return assessment.body
}

function attempts() {
  const rows = new Map()
  function store(companyId, customerId) {
    const key = `${companyId}:${customerId}`
    return {
      key,
      async reserve() {
        const row = rows.get(key)
        if (!row || row.state === "rejected") {
          rows.set(key, { state: "register_sent", code: null, iptvId: null })
          return { granted: true, state: "register_sent", latamCode: null }
        }
        return { granted: false, state: row.state, latamCode: row.code }
      },
      async read() {
        const row = rows.get(key)
        return row
          ? { state: row.state, latamCode: row.code, iptvId: row.iptvId }
          : null
      },
      async finish(state, latamCode = null, iptvId = null) {
        const row = rows.get(key)
        if (!row || state === "rejected") return "unavailable"
        const stored = latamIptvId(iptvId, latamCode)
        if (row.iptvId && stored && row.iptvId !== stored) return "unavailable"
        if (stored) row.iptvId = stored
        row.code = latamCode ?? row.code
        row.state = state
        return "saved"
      },
      async release() {
        const row = rows.get(key)
        if (!row || row.state !== "pending_sync") return "blocked"
        if (row.code === 1 || row.code === 3 || row.code == null) return "blocked"
        row.state = "rejected"
        return "released"
      },
      async rememberIptv(iptvId) {
        const stored = latamIptvId(iptvId)
        if (!stored) return "unavailable"
        const row = rows.get(key)
        if (!row) {
          rows.set(key, { state: "confirmed", code: null, iptvId: stored })
          return "saved"
        }
        if (row.iptvId && row.iptvId !== stored) return "conflict"
        row.iptvId = stored
        if (row.state !== "confirmed") row.state = "confirmed"
        return "saved"
      },
    }
  }
  return { store, rows }
}

function clientRow(iptvId = 80) {
  return {
    identificador: "6797",
    id_crm: "6797",
    id_iptv: iptvId,
    status: 1,
    usuario: "cliente@email.com",
  }
}

/** Padrón real: hay id_iptv, no hay identificador e id_crm llega vacío. */
function realCatalogRow(iptvId = 80) {
  return {
    id_iptv: iptvId,
    id_crm: null,
    status: 1,
    usuario: "cliente@email.com",
  }
}

test("un cliente ya existente no se vuelve a registrar y conserva su id_iptv", async () => {
  const book = attempts()
  const own = book.store("company-a", "customer-a")
  const other = book.store("company-b", "customer-b")
  other.rememberIptv("44")
  let registers = 0
  const result = await signUpLatamTvClient(bodyFor(), {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: own,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/register-client") registers += 1
      return jsonResponse({ code: 1, clients: [clientRow(80)] })
    },
  })
  assert.equal(registers, 0)
  assert.equal(result.outcome, "already_exists")
  if (result.outcome === "already_exists") assert.equal(result.iptvId, "80")
  assert.equal((await own.read())?.iptvId, "80")
  assert.equal((await other.read())?.iptvId, "44")
  assert.notEqual((await own.read())?.iptvId, "1")
})

test("un alta confirmada persiste el id_iptv y no el code 1", async () => {
  const book = attempts()
  const own = book.store("company-a", "customer-a")
  let registers = 0
  let listed = false
  const result = await signUpLatamTvClient(bodyFor(), {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: own,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/get-clients") {
        return jsonResponse(
          listed ? { code: 1, clients: [clientRow(80)] } : { code: 3 }
        )
      }
      registers += 1
      listed = true
      return jsonResponse({ error: false, code: 1 })
    },
  })
  assert.equal(registers, 1)
  assert.equal(result.outcome, "created")
  if (result.outcome === "created") {
    assert.equal(result.iptvId, "80")
    assert.notEqual(result.iptvId, "1")
  }
  assert.equal((await own.read())?.state, "confirmed")
  assert.equal((await own.read())?.iptvId, "80")
  const again = await signUpLatamTvClient(bodyFor(), {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: own,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/register-client") registers += 1
      return jsonResponse({ code: 1, clients: [clientRow(80)] })
    },
  })
  assert.equal(registers, 1)
  assert.equal(again.outcome, "already_exists")
})

test("code 1 no se guarda como id_iptv", () => {
  assert.equal(latamIptvId(1, 1), null)
  assert.equal(latamIptvId("1", 1), null)
  assert.equal(latamIptvId("80", 1), "80")
  assert.equal(
    latamSignupVisibleLabel({ state: "confirmed", iptvId: null }),
    "Alta enviada, pendiente de verificación"
  )
})

test("un timeout deja el intento pendiente y no dispara otro register-client", async () => {
  const book = attempts()
  const own = book.store("company-a", "customer-a")
  let registers = 0
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname
    if (path === "/api/get-clients") return jsonResponse({ code: 3 })
    registers += 1
    throw new Error("timeout")
  }
  const first = await signUpLatamTvClient(bodyFor(), {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: own,
    fetchImpl,
  })
  const second = await signUpLatamTvClient(bodyFor(), {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: own,
    fetchImpl,
  })
  assert.equal(first.outcome, "pending_sync")
  assert.equal(second.outcome, "pending_sync")
  assert.equal(registers, 1)
  assert.equal((await own.read())?.state, "pending_sync")
})

test("un intento pendiente se resuelve consultando y sin registrar de nuevo", async () => {
  const book = attempts()
  const own = book.store("company-a", "customer-a")
  await own.reserve()
  await own.finish("pending_sync", 1, null)
  let registers = 0
  const result = await refreshLatamSignupByNumber(bodyFor(), {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: own,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/register-client") registers += 1
      return jsonResponse({ code: 1, clients: [clientRow(80)] })
    },
  })
  assert.equal(registers, 0)
  assert.equal(result.outcome, "already_exists")
  if (result.outcome === "already_exists") assert.equal(result.iptvId, "80")
  assert.equal((await own.read())?.state, "confirmed")
  assert.equal((await own.read())?.iptvId, "80")
})

test("una coincidencia ambigua exige revisión y no asocia el abonado", async () => {
  const book = attempts()
  const own = book.store("company-a", "customer-a")
  let registers = 0
  const result = await signUpLatamTvClient(bodyFor(), {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: own,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/register-client") registers += 1
      return jsonResponse({
        code: 1,
        clients: [clientRow(80), { ...clientRow(81), id_iptv: 81 }],
      })
    },
  })
  assert.equal(registers, 0)
  assert.equal(result.outcome, "rejected")
  if (result.outcome === "rejected") assert.match(result.message, /revisión|identidad/i)
  assert.equal(await own.read(), null)
})

test("el intento de otra empresa no se modifica", async () => {
  const book = attempts()
  const own = book.store("company-a", "customer-a")
  const other = book.store("company-b", "customer-b")
  await other.rememberIptv("44")
  await own.rememberIptv("80")
  const conflict = await own.rememberIptv("91")
  assert.equal(conflict, "conflict")
  assert.equal((await own.read())?.iptvId, "80")
  assert.equal((await other.read())?.iptvId, "44")
  assert.equal((await other.read())?.state, "confirmed")
})

test("los rechazos documentados se interpretan y permiten un alta posterior", async () => {
  const book = attempts()
  const own = book.store("company-a", "customer-a")
  let registers = 0
  const rejected = await signUpLatamTvClient(bodyFor(), {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: own,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/get-clients") return jsonResponse({ code: 3 })
      registers += 1
      return jsonResponse({ code: 5 })
    },
  })
  assert.equal(rejected.outcome, "rejected")
  if (rejected.outcome === "rejected") {
    assert.equal(rejected.message, latamRegisterRejectionMessage(5))
    assert.equal(rejected.code, 5)
  }
  assert.equal((await own.read())?.state, "rejected")
  const listed = { current: false }
  const again = await signUpLatamTvClient(bodyFor(), {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: own,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/get-clients") {
        return jsonResponse(listed.current ? { code: 1, clients: [clientRow(80)] } : { code: 3 })
      }
      registers += 1
      listed.current = true
      return jsonResponse({ error: false, code: 1 })
    },
  })
  assert.equal(registers, 2)
  assert.equal(again.outcome, "created")
  if (again.outcome === "created") assert.equal(again.iptvId, "80")
})

test("un cliente ya confirmado no se vuelve a registrar", async () => {
  const book = attempts()
  const own = book.store("company-a", "customer-a")
  await own.rememberIptv("80")
  let registers = 0
  const result = await signUpLatamTvClient(bodyFor(), {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: own,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/register-client") registers += 1
      return jsonResponse({ code: 3 })
    },
  })
  assert.equal(registers, 0)
  assert.equal(result.outcome, "pending_sync")
  assert.equal((await own.read())?.iptvId, "80")
  assert.equal((await own.read())?.state, "confirmed")
})

test("la interfaz usa el intento persistido", () => {
  const unregistered = {
    phase: "unregistered",
    identifier: null,
    iptvId: null,
    username: null,
    planName: null,
  }
  const row = {
    abnetCustomerNumber: "6797",
    bespokeCustomerId: "customer-a",
    bespokeLink: "one",
    latamCredentialGap: null,
    latamSignupAttempt: { state: "confirmed", latamCode: 1, iptvId: "80" },
  }
  assert.equal(padronLatamMode(row, { 6797: unregistered }).kind, "confirmed")
  assert.equal(
    padronLatamMode(
      { ...row, latamSignupAttempt: { state: "pending_sync", latamCode: null, iptvId: null } },
      { 6797: unregistered }
    ).kind,
    "pending_sync"
  )
  assert.equal(
    latamSignupVisibleLabel({ state: "rejected", iptvId: null }),
    "Alta en Latam pendiente de envío"
  )
  assert.equal(latamSignupVisibleLabel(null), "Alta en Latam pendiente de envío")
})

test("get-clients con id_iptv y sin identificador ni id_crm no vuelve a registrar", async () => {
  const book = attempts()
  const own = book.store("company-a", "customer-a")
  let registers = 0
  const result = await signUpLatamTvClient(bodyFor(), {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: own,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/register-client") registers += 1
      assert.equal("identificador" in realCatalogRow(), false)
      return jsonResponse({ code: 1, clients: [realCatalogRow(80)] })
    },
  })
  assert.equal(registers, 0)
  assert.equal(result.outcome, "already_exists")
  if (result.outcome === "already_exists") {
    assert.equal(result.iptvId, "80")
    assert.notEqual(result.iptvId, "1")
  }
  assert.equal((await own.read())?.iptvId, "80")
  assert.equal((await own.read())?.state, "confirmed")
})

test("un alta nueva recupera el id_iptv de una fila sin identificador ni id_crm", async () => {
  const book = attempts()
  const own = book.store("company-a", "customer-a")
  let registers = 0
  let listed = false
  const result = await signUpLatamTvClient(bodyFor(), {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: own,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/get-clients") {
        return jsonResponse(listed ? { code: 1, clients: [realCatalogRow(80)] } : { code: 3 })
      }
      registers += 1
      listed = true
      return jsonResponse({ error: false, code: 1 })
    },
  })
  assert.equal(registers, 1)
  assert.equal(result.outcome, "created")
  if (result.outcome === "created") {
    assert.equal(result.iptvId, "80")
    assert.notEqual(result.iptvId, "1")
  }
  assert.equal((await own.read())?.iptvId, "80")
  const again = await signUpLatamTvClient(bodyFor(), {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: own,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/register-client") registers += 1
      return jsonResponse({ code: 1, clients: [realCatalogRow(80)] })
    },
  })
  assert.equal(registers, 1)
  assert.equal(again.outcome, "already_exists")
})

test("dos filas sin identificador ni id_crm no se vinculan ni se registran", async () => {
  const book = attempts()
  const own = book.store("company-a", "customer-a")
  let registers = 0
  const result = await signUpLatamTvClient(bodyFor(), {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: own,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/register-client") registers += 1
      return jsonResponse({
        code: 1,
        clients: [realCatalogRow(80), realCatalogRow(81)],
      })
    },
  })
  assert.equal(registers, 0)
  assert.equal(result.outcome, "rejected")
  assert.equal(await own.read(), null)
})

test("si el cierre del intento falla no se repite register-client", async () => {
  const book = attempts()
  const own = book.store("company-a", "customer-a")
  own.finish = async () => "unavailable"
  let registers = 0
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname
    if (path === "/api/get-clients") return jsonResponse({ code: 3 })
    registers += 1
    return jsonResponse({ error: false, code: 1 })
  }
  const first = await signUpLatamTvClient(bodyFor(), {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: own,
    fetchImpl,
  })
  const second = await signUpLatamTvClient(bodyFor(), {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: own,
    fetchImpl,
  })
  assert.equal(first.outcome, "pending_sync")
  assert.equal(second.outcome, "pending_sync")
  assert.equal(registers, 1)
  assert.equal((await own.read())?.state, "register_sent")
  assert.equal((await own.read())?.iptvId, null)
})

test("la firma vieja no guarda id_iptv y la reconsulta posterior no duplica el alta", async () => {
  let row = null
  let migrated = false
  const store = createLatamSignupAttemptStore(
    {
      rpc: async (fn, args) => {
        if (fn === "reserve_latam_tv_signup_attempt") {
          if (!row || row.state === "rejected") {
            row = { state: "register_sent", code: null, iptv: null }
            return { data: { granted: true, state: "register_sent", latam_code: null }, error: null }
          }
          return { data: { granted: false, state: row.state, latam_code: row.code }, error: null }
        }
        if (fn === "read_latam_tv_signup_attempt") {
          if (!row) return { data: { state: null }, error: null }
          return {
            data: { state: row.state, latam_code: row.code, id_iptv: row.iptv },
            error: null,
          }
        }
        if (fn === "finish_latam_tv_signup_attempt") {
          if (!migrated && Object.prototype.hasOwnProperty.call(args, "p_id_iptv")) {
            return {
              data: null,
              error: {
                message:
                  "Could not find the function public.finish_latam_tv_signup_attempt(uuid, text, integer, text) in the schema cache",
              },
            }
          }
          if (!row) return { data: { saved: false }, error: null }
          row.state = args.p_state
          row.code = args.p_latam_code ?? row.code
          if (migrated && args.p_id_iptv) row.iptv = args.p_id_iptv
          return { data: { saved: true, state: row.state }, error: null }
        }
        if (fn === "remember_latam_tv_signup_iptv") {
          if (!migrated) {
            return {
              data: null,
              error: {
                message: "Could not find the function remember_latam_tv_signup_iptv in the schema cache",
              },
            }
          }
          if (!row) row = { state: "confirmed", code: null, iptv: args.p_id_iptv }
          else {
            row.iptv = args.p_id_iptv
            row.state = "confirmed"
          }
          return { data: { saved: true, id_iptv: row.iptv }, error: null }
        }
        return { data: null, error: { message: "missing" } }
      },
    },
    "customer-a"
  )
  let registers = 0
  let listed = false
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname
    if (path === "/api/get-clients") {
      return jsonResponse(listed ? { code: 1, clients: [realCatalogRow(80)] } : { code: 3 })
    }
    registers += 1
    listed = true
    return jsonResponse({ error: false, code: 1 })
  }
  const first = await signUpLatamTvClient(bodyFor(), {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: store,
    fetchImpl,
  })
  assert.equal(first.outcome, "pending_sync")
  assert.equal(registers, 1)
  assert.equal(row.state, "pending_sync")
  assert.equal(row.iptv, null)
  const second = await signUpLatamTvClient(bodyFor(), {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: store,
    fetchImpl,
  })
  assert.equal(registers, 1)
  assert.equal(second.outcome, "already_exists")
  assert.equal(row.iptv, null)
  migrated = true
  const resolved = await refreshLatamSignupByNumber(bodyFor(), {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: store,
    fetchImpl,
  })
  assert.equal(registers, 1)
  assert.equal(resolved.outcome, "already_exists")
  if (resolved.outcome === "already_exists") assert.equal(resolved.iptvId, "80")
  assert.equal(row.iptv, "80")
  assert.equal(row.state, "confirmed")
})

test("un cierre local fallido en el alta por identidad no confirma ni repite el registro", async () => {
  const book = attempts()
  const own = book.store("company-a", "customer-a")
  own.finish = async () => "unavailable"
  const assessment = assessLatamSignup({
    name: "Marta Nieto",
    dni: "30.123.456",
    email: "marta@example.com",
    phone: "3515551234",
    address: "Calle 10",
    identifier: null,
    identitySignup: true,
    tvKind: "basica",
    planId: "latam-plan-99",
  })
  assert.equal(assessment.ready, true)
  if (!assessment.ready) throw new Error("alta no lista")
  assert.equal("identificador" in assessment.body, false)
  let registers = 0
  let confirmCatalog = false
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname
    if (path === "/api/get-clients") {
      const clients = confirmCatalog
        ? [
            {
              identificador: "4412",
              id_crm: "4412",
              id_iptv: 29,
              dni: "30123456",
              usuario: "marta@example.com",
              status: 1,
              nombres: "Marta",
              apellido: "Nieto",
            },
          ]
        : [
            {
              identificador: "5788",
              id_crm: "5788",
              id_iptv: 12,
              dni: "20999888",
              usuario: "marisa@example.com",
              status: 1,
            },
          ]
      return jsonResponse({ code: 1, clients })
    }
    registers += 1
    confirmCatalog = true
    return jsonResponse({ error: false, code: 1 })
  }
  const first = await signUpLatamTvClient(assessment.body, {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: own,
    fetchImpl,
  })
  assert.equal(first.outcome, "pending_sync")
  assert.notEqual(first.outcome, "created")
  assert.equal(registers, 1)
  assert.equal((await own.read())?.state, "register_sent")
  assert.equal((await own.read())?.iptvId, null)
  confirmCatalog = false
  const second = await signUpLatamTvClient(assessment.body, {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: own,
    fetchImpl,
  })
  assert.equal(second.outcome, "pending_sync")
  assert.notEqual(second.outcome, "created")
  assert.equal(registers, 1)
  assert.equal((await own.read())?.state, "register_sent")
})

test("la migración local separa id_iptv del code y no borra intentos", () => {
  const sql = readFileSync(
    resolve(import.meta.dirname, "../supabase/migrations/20270119120000_latam_tv_signup_attempt_iptv.sql"),
    "utf8"
  )
  assert.match(sql, /ADD COLUMN IF NOT EXISTS id_iptv text/)
  assert.match(sql, /v_iptv = p_latam_code::text/)
  assert.match(sql, /company_id = v_company/)
  assert.match(sql, /customer_id = p_customer_id/)
  assert.match(sql, /aplicar esta migración antes de publicar la aplicación/)
  assert.match(
    sql,
    /DROP FUNCTION IF EXISTS public\.finish_latam_tv_signup_attempt\(uuid, text, integer\);/
  )
  assert.doesNotMatch(
    sql,
    /DROP FUNCTION[^;]*finish_latam_tv_signup_attempt\(uuid, text, integer, text\)/
  )
  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.finish_latam_tv_signup_attempt\(\s*p_customer_id uuid,\s*p_state text,\s*p_latam_code integer DEFAULT NULL,\s*p_id_iptv text DEFAULT NULL/
  )
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.finish_latam_tv_signup_attempt\(uuid, text, integer, text\) TO authenticated/
  )
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.finish_latam_tv_signup_attempt\(uuid, text, integer, text\) FROM anon/
  )
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.remember_latam_tv_signup_iptv\(uuid, text\) TO authenticated/
  )
  assert.doesNotMatch(sql, /\bDELETE\b/i)
  assert.doesNotMatch(sql, /DROP TABLE/i)
  assert.doesNotMatch(sql, /GRANT EXECUTE ON FUNCTION public\.finish_latam_tv_signup_attempt\(uuid, text, integer, text\) TO anon/)
})
