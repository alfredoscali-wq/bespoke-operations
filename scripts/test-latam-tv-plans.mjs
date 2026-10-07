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
  formatLatamPlanDiagnosis,
  latamOperationalPlanIds,
  matchLatamTvPlans,
  normalizeLatamPlanName,
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

function catalog() {
  return {
    code: 1,
    plans: [
      plan("9", "Plan Full", ["full", "premium"]),
      plan(2, "Plan Basico + Pack Futbol", [{ nombre: "futbol" }]),
      plan("1", "  Plan   Basico  ", "basico"),
      plan("40", "Plan Eventos", ["eventos"]),
    ],
  }
}

test("1-4. tres planes se identifican por nombre y conservan pl_id y categorías", async () => {
  const calls = []
  const plans = await getLatamTvPlans({
    baseUrl: BASE,
    token: TOKEN,
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return jsonResponse(catalog())
    },
  })
  const diagnosis = matchLatamTvPlans(plans)
  assert.equal(calls.length, 1)
  const url = new URL(calls[0].url)
  assert.equal(url.pathname, "/api/get-plans")
  assert.equal(url.searchParams.get("token"), TOKEN)
  assert.equal(calls[0].init.method, "POST")
  assert.equal(JSON.stringify(plans).includes(TOKEN), false)
  assert.equal(JSON.stringify(plans).includes("password"), false)

  assert.equal(normalizeLatamPlanName("  Plan   Basico  "), "Plan Basico")
  assert.deepEqual(
    diagnosis.correspondence.map((row) => [row.bespokeLabel, row.latamName, row.planId, row.status]),
    [
      ["TV Básica", "Plan Basico", "1", "ok"],
      ["TV Básica + Pack Fútbol", "Plan Basico + Pack Futbol", "2", "ok"],
      ["TV Full", "Plan Full", "9", "not_operational"],
    ]
  )
  assert.deepEqual(diagnosis.correspondence[0].categories, ["basico"])
  assert.deepEqual(diagnosis.correspondence[1].categories, ["futbol"])
  assert.deepEqual(diagnosis.correspondence[2].categories, ["full", "premium"])
  assert.equal(latamPlanIdForTvKind("basica", diagnosis), "1")
  assert.equal(latamPlanIdForTvKind("pack", diagnosis), "2")
  assert.equal(latamPlanIdForTvKind("full", diagnosis), null)
  assert.equal(latamSignupPlanGap("full", diagnosis), LATAM_FULL_SIGNUP_BLOCKED)
  assert.deepEqual(latamOperationalPlanIds(diagnosis), { basica: "1", pack: "2" })
  assert.deepEqual(formatLatamPlanDiagnosis(diagnosis), [
    "TV Básica → Plan Basico → pl_id 1 → OK",
    "TV Básica + Pack Fútbol → Plan Basico + Pack Futbol → pl_id 2 → OK",
    "TV Full → Plan Full → pl_id 9 → NO OPERATIVO",
  ])
  assert.deepEqual(
    diagnosis.otherPlans.map((item) => item.id),
    ["40"]
  )
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

test("8-10. HTTP inválido, JSON inválido y error de API no exponen el token", async () => {
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
        fetchImpl: async () => jsonResponse({ code: 2, message: TOKEN }),
      }),
    (error) => {
      assert.ok(error instanceof LatamTvRequestError)
      assert.equal(error.message.includes(TOKEN), false)
      return true
    }
  )
})

test("11-12. el token no sale y get-plans no escribe", () => {
  const client = read("lib/integrations/latam-tv/client.ts")
  const plans = read("lib/integrations/latam-tv/plans.ts")
  const script = read("scripts/latam-tv-get-plans.mjs")
  const moduleUi = read("components/subscriptions/subscriptions-module.tsx")
  const paths = client.match(/\/api\/[a-z0-9-]+/g) ?? []
  assert.deepEqual([...new Set(paths)].sort(), [
    "/api/get-clients",
    "/api/get-plans",
    "/api/register-client",
  ])
  for (const path of [
    "/api/create-plan",
    "/api/update-plan",
    "/api/delete-plan",
    "/api/modify-plan",
    "/api/modify-client",
    "/api/delete-client",
    "/api/disable-client",
    "/api/enable-client",
    "/api/modify-password",
  ]) {
    assert.equal(client.includes(path), false)
    assert.equal(script.includes(path), false)
    assert.equal(plans.includes(path), false)
  }
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
