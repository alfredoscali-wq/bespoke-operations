/**
 * Catálogo LATAM TV de solo lectura. No llama a la API real.
 * La correspondencia es por nombre exacto. Los pl_id salen del mock de get-plans.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { getLatamTvPlans } from "../lib/integrations/latam-tv/client.ts"
import { LatamTvRequestError } from "../lib/integrations/latam-tv/errors.ts"
import {
  formatLatamPlanCatalog,
  latamOperationalPlanIds,
  matchLatamTvPlans,
  normalizeLatamPlanName,
  readLatamTvPlansPayload,
} from "../lib/integrations/latam-tv/plans.ts"
import {
  LATAM_FULL_SIGNUP_BLOCKED,
  latamPlanIdForTvKind,
  latamSignupPlanGap,
} from "../lib/integrations/latam-tv/signup.ts"

const root = resolve(import.meta.dirname, "..")
const TOKEN = "latam-plans-token-do-not-leak"
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

function plan(id, nombre, categorias) {
  return { pl_id: id, nombre, categorias, token: TOKEN, password: "no" }
}

function realCatalog(overrides = {}) {
  return {
    error: false,
    planes: [
      plan(1, "PlanTienda", [{ id: 351, nombre: "Tienda" }]),
      plan(2, overrides.basicoName ?? "Plan Basico", [
        { id: 1, nombre: "TV Abierta" },
        { id: 8, nombre: "Deporte" },
      ]),
      plan(3, "Plan Basico + Pack Futbol", [
        { id: 1, nombre: "TV Abierta" },
        { id: 361, nombre: "Futbol Premium" },
      ]),
      plan(10, "Prueba CD-LATAM", [{ id: 366, nombre: "Prueba CD-LATAM" }]),
    ],
  }
}

test("1-7. la respuesta real mapea Básica y Pack y deja el resto sin correspondencia", async () => {
  const calls = []
  const plans = await getLatamTvPlans({
    baseUrl: BASE,
    token: TOKEN,
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return jsonResponse(realCatalog())
    },
  })
  const diagnosis = matchLatamTvPlans(plans)
  assert.equal(calls.length, 1)
  const url = new URL(calls[0].url)
  assert.equal(url.pathname, "/api/get-plans")
  assert.equal(url.searchParams.get("token"), TOKEN)
  assert.equal(calls[0].init.method, "POST")
  assert.equal(JSON.stringify(plans).includes(TOKEN), false)
  assert.equal(JSON.stringify(diagnosis).includes(TOKEN), false)

  assert.deepEqual(
    plans.map((item) => [item.id, item.name]),
    [
      ["1", "PlanTienda"],
      ["2", "Plan Basico"],
      ["3", "Plan Basico + Pack Futbol"],
      ["10", "Prueba CD-LATAM"],
    ]
  )
  assert.deepEqual(plans[0].categories, ["Tienda (351)"])
  assert.deepEqual(plans[1].categories, ["TV Abierta (1)", "Deporte (8)"])
  assert.deepEqual(
    diagnosis.correspondence.map((row) => [row.bespokeKind, row.planId, row.status]),
    [
      ["basica", "2", "ok"],
      ["pack", "3", "ok"],
      ["full", null, "unmapped"],
    ]
  )
  assert.equal(latamPlanIdForTvKind("basica", diagnosis), "2")
  assert.equal(latamPlanIdForTvKind("pack", diagnosis), "3")
  assert.equal(latamPlanIdForTvKind("full", diagnosis), null)
  assert.equal(latamSignupPlanGap("full", diagnosis), LATAM_FULL_SIGNUP_BLOCKED)
  assert.deepEqual(latamOperationalPlanIds(diagnosis), { basica: "2", pack: "3" })
  assert.deepEqual(
    diagnosis.otherPlans.map((item) => item.name),
    ["PlanTienda", "Prueba CD-LATAM"]
  )
  assert.deepEqual(formatLatamPlanCatalog(diagnosis), [
    "1 | PlanTienda | Tienda (351) | Sin correspondencia",
    "2 | Plan Basico | TV Abierta (1), Deporte (8) | TV Básica",
    "3 | Plan Basico + Pack Futbol | TV Abierta (1), Futbol Premium (361) | TV Básica + Pack Fútbol",
    "10 | Prueba CD-LATAM | Prueba CD-LATAM (366) | Sin correspondencia",
    "TV Full | no disponible",
  ])
})

test("8. espacios redundantes no cambian el nombre", async () => {
  const plans = await getLatamTvPlans({
    baseUrl: BASE,
    token: TOKEN,
    fetchImpl: async () => jsonResponse(realCatalog({ basicoName: "  Plan   Basico  " })),
  })
  assert.equal(normalizeLatamPlanName("  Plan   Basico  "), "Plan Basico")
  const diagnosis = matchLatamTvPlans(plans)
  assert.equal(latamPlanIdForTvKind("basica", diagnosis), "2")
  assert.equal(diagnosis.correspondence.find((row) => row.bespokeKind === "basica").status, "ok")
})

test("5-7. plan inexistente, nombre inesperado y nombres duplicados quedan unmapped", () => {
  const missing = matchLatamTvPlans([
    { id: "1", name: "Plan Basico", categories: [] },
    { id: "8", name: "Plan Básico", categories: ["acento"] },
  ])
  const pack = missing.correspondence.find((row) => row.bespokeKind === "pack")
  const full = missing.correspondence.find((row) => row.bespokeKind === "full")
  assert.equal(pack.status, "unmapped")
  assert.equal(pack.reason, "missing")
  assert.equal(pack.planId, null)
  assert.equal(full.planId, null)
  assert.equal(latamPlanIdForTvKind("pack", missing), null)
  assert.deepEqual(
    missing.otherPlans.map((item) => item.name),
    ["Plan Básico"]
  )

  const duplicated = matchLatamTvPlans([
    { id: "1", name: "Plan Basico", categories: ["a"] },
    { id: "7", name: "Plan Basico", categories: ["b"] },
    { id: "2", name: "Plan Basico + Pack Futbol", categories: [] },
    { id: "9", name: "Plan Full", categories: [] },
  ])
  const basica = duplicated.correspondence.find((row) => row.bespokeKind === "basica")
  assert.equal(basica.status, "unmapped")
  assert.equal(basica.reason, "duplicate")
  assert.equal(basica.planId, null)
  assert.equal(latamPlanIdForTvKind("basica", duplicated), null)
  assert.equal(latamOperationalPlanIds(duplicated), null)
  assert.equal(latamPlanIdForTvKind("pack", duplicated), "2")
})

test("9. un nombre distinto queda unmapped", () => {
  const diagnosis = matchLatamTvPlans([
    { id: "2", name: "Plan Básico", categories: [] },
    { id: "3", name: "Plan Basico + Pack Futbol", categories: [] },
  ])
  const basica = diagnosis.correspondence.find((row) => row.bespokeKind === "basica")
  assert.equal(basica.status, "unmapped")
  assert.equal(basica.planId, null)
  assert.equal(latamPlanIdForTvKind("basica", diagnosis), null)
  assert.deepEqual(
    diagnosis.otherPlans.map((item) => item.name),
    ["Plan Básico"]
  )
})

test("11-14. error true, planes ausente, JSON inválido y HTTP no OK", async () => {
  await assert.rejects(
    () =>
      getLatamTvPlans({
        baseUrl: BASE,
        token: TOKEN,
        fetchImpl: async () => jsonResponse({ error: true, message: TOKEN }),
      }),
    (error) => {
      assert.ok(error instanceof LatamTvRequestError)
      assert.equal(error.kind, "unavailable")
      assert.equal(error.message.includes(TOKEN), false)
      return true
    }
  )
  assert.throws(
    () => readLatamTvPlansPayload({ error: false, token: TOKEN }),
    (error) => error instanceof LatamTvRequestError
  )
  assert.throws(
    () => readLatamTvPlansPayload({ error: false, plans: [], code: 1 }),
    (error) => error instanceof LatamTvRequestError
  )
  await assert.rejects(
    () =>
      getLatamTvPlans({
        baseUrl: BASE,
        token: TOKEN,
        fetchImpl: async () => new Response("no-es-json", { status: 200 }),
      }),
    (error) => error instanceof LatamTvRequestError && error.kind === "unavailable"
  )
  await assert.rejects(
    () =>
      getLatamTvPlans({
        baseUrl: BASE,
        token: TOKEN,
        fetchImpl: async () => jsonResponse({ secret: TOKEN }, 500),
      }),
    (error) => {
      assert.ok(error instanceof LatamTvRequestError)
      assert.equal(error.message.includes(TOKEN), false)
      return true
    }
  )
})

test("15-16. el token no sale y get-plans no escribe", () => {
  const client = read("lib/integrations/latam-tv/client.ts")
  const plans = read("lib/integrations/latam-tv/plans.ts")
  const script = read("scripts/latam-tv-get-plans.mjs")
  const moduleUi = read("components/subscriptions/subscriptions-module.tsx")
  const paths = client.match(/\/api\/[a-z0-9-]+/g) ?? []
  assert.deepEqual([...new Set(paths)].sort(), [
    "/api/disable-client",
    "/api/enable-client",
    "/api/get-clients",
    "/api/get-plans",
    "/api/modify-password",
    "/api/register-client",
  ])
  for (const path of [
    "/api/create-plan",
    "/api/update-plan",
    "/api/delete-plan",
    "/api/modify-plan",
    "/api/modify-client",
    "/api/delete-client",
  ]) {
    assert.equal(client.includes(path), false)
    assert.equal(script.includes(path), false)
    assert.equal(plans.includes(path), false)
  }
  assert.equal(script.includes("/api/modify-password"), false)
  assert.equal(plans.includes("/api/modify-password"), false)
  assert.equal(script.includes("/api/disable-client"), false)
  assert.equal(script.includes("/api/enable-client"), false)
  assert.equal(plans.includes("/api/disable-client"), false)
  assert.equal(plans.includes("/api/enable-client"), false)
  assert.match(plans, /payload\.error !== false/)
  assert.match(plans, /payload\.planes/)
  assert.doesNotMatch(plans, /payload\.code/)
  assert.doesNotMatch(plans, /payload\.plans\b/)
  assert.match(script, /getLatamTvPlans/)
  assert.doesNotMatch(script, /signUpLatamTvClient/)
  assert.doesNotMatch(script, /console\.(log|info|debug|warn|error)\([^)]*token/)
  assert.equal(plans.includes(TOKEN), false)
  assert.equal(script.includes(TOKEN), false)
  assert.doesNotMatch(moduleUi, /Plan Basico/)
  assert.doesNotMatch(moduleUi, /pl_id/)
  assert.equal(latamPlanIdForTvKind("basica"), null)
  assert.equal(latamPlanIdForTvKind("pack"), null)
  assert.equal(latamPlanIdForTvKind("full"), null)
})
