/**
 * Cambio de plan LATAM. No llama a la API real ni crea planes.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { changeLatamClientPlan } from "../lib/integrations/latam-tv/client.ts"
import { LatamTvRequestError } from "../lib/integrations/latam-tv/errors.ts"
import { latamIdentifierFromCustomer } from "../lib/integrations/latam-tv/identifier.ts"
import {
  latamChangePlanTarget,
  latamCommercialPlanOptions,
  latamPlanNameKey,
  matchLatamTvPlans,
} from "../lib/integrations/latam-tv/plans.ts"

const root = resolve(import.meta.dirname, "..")
const TOKEN = "latam-plan-token-do-not-leak"
const BASE = "https://abnetv.cd-latam.com"
const BASIC_ID = "81"
const PACK_ID = "82"
const FULL_ID = "640"

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function catalog(extra = []) {
  return {
    error: false,
    planes: [
      { pl_id: "1", nombre: "PlanTienda", categorias: [] },
      { pl_id: BASIC_ID, nombre: "Plan Basico", categorias: [] },
      { pl_id: PACK_ID, nombre: "Plan Basico + Pack Futbol", categorias: [] },
      { pl_id: "10", nombre: "Prueba CD-LATAM", categorias: [] },
      ...extra,
    ],
  }
}

function clientRecord(identifier, status, planId, planName) {
  return {
    code: 1,
    clients: [
      {
        id_crm: identifier,
        usuario: "cliente@email.com",
        status,
        plan_id: planId,
        plan_name: planName,
        token: TOKEN,
      },
    ],
  }
}

function mapped(plans) {
  return matchLatamTvPlans(
    plans.map((plan) => ({ id: plan.id, name: plan.name, categories: [] }))
  )
}

test("1-9. el mapping sale del nombre normalizado y no de un id fijo", () => {
  const diagnosis = mapped([
    { id: BASIC_ID, name: "  PLAN   BASICO  " },
    { id: PACK_ID, name: "Plan Basico + Pack Futbol" },
    { id: "1", name: "PlanTienda" },
    { id: "10", name: "Prueba CD-LATAM" },
    { id: "70", name: "Plan Basico Premium" },
  ])
  const options = latamCommercialPlanOptions(diagnosis)
  assert.equal(latamChangePlanTarget("basica", diagnosis)?.planId, BASIC_ID)
  assert.equal(latamChangePlanTarget("pack", diagnosis)?.planId, PACK_ID)
  assert.equal(latamChangePlanTarget("full", diagnosis), null)
  assert.equal(diagnosis.correspondence.find((row) => row.bespokeKind === "full").status, "unmapped")
  assert.deepEqual(
    options.map((option) => option.label),
    ["TV Básica", "TV Básica + Pack Fútbol", "TV Full"]
  )
  assert.equal(options.find((option) => option.kind === "full").available, false)
  assert.equal(options.some((option) => option.latamName === "PlanTienda"), false)
  assert.equal(options.some((option) => option.label.includes("Prueba")), false)
  assert.equal(latamPlanNameKey("Plan   Basico"), latamPlanNameKey("plan basico"))
  assert.notEqual(latamPlanNameKey("Plan Basico"), latamPlanNameKey("Plan Básico"))
  assert.notEqual(latamPlanNameKey("Plan Basico"), latamPlanNameKey("Plan Basico Premium"))
})

test("4 y 27-30. Plan Full se habilita solo con el id del catálogo", () => {
  const missing = mapped([{ id: BASIC_ID, name: "Plan Basico" }])
  assert.equal(latamChangePlanTarget("full", missing), null)
  const present = mapped([
    { id: BASIC_ID, name: "Plan Basico" },
    { id: FULL_ID, name: "plan   full" },
  ])
  assert.equal(latamChangePlanTarget("full", present)?.planId, FULL_ID)
  const plans = read("lib/integrations/latam-tv/plans.ts")
  const client = read("lib/integrations/latam-tv/client.ts")
  assert.match(plans, /latamName: "Plan Full"/)
  assert.doesNotMatch(plans, /Plan Full"[\s\S]{0,40}\d{2,}/)
  assert.doesNotMatch(client, /id_plan:\s*"\d+"/)
  assert.equal(client.includes(FULL_ID), false)
  assert.equal(plans.includes(FULL_ID), false)
})

async function change(kind, identifier, handler) {
  const calls = []
  const result = await changeLatamClientPlan(identifier, kind, {
    baseUrl: BASE,
    token: TOKEN,
    fetchImpl: async (url, init) => {
      const endpoint = new URL(url)
      const body = JSON.parse(init.body)
      calls.push({ path: endpoint.pathname, body })
      return handler(endpoint.pathname, calls)
    },
  })
  return { result, calls }
}

test("10 y 15-19. un cliente activo cambia de plan y la reconsulta confirma", async () => {
  let lookups = 0
  const { result, calls } = await change("pack", "4401", (path) => {
    if (path === "/api/get-clients") {
      lookups += 1
      return jsonResponse(
        clientRecord("4401", 1, lookups === 1 ? BASIC_ID : PACK_ID, lookups === 1 ? "Plan Basico" : "Plan Basico + Pack Futbol")
      )
    }
    if (path === "/api/get-plans") return jsonResponse(catalog())
    if (path === "/api/modify-client") return jsonResponse({ code: 1, token: TOKEN })
    throw new Error(path)
  })
  assert.equal(result.outcome, "updated")
  assert.equal(result.status, "enabled")
  assert.equal(result.planName, "Plan Basico + Pack Futbol")
  assert.equal(result.planId, PACK_ID)
  assert.equal(JSON.stringify(result).includes(TOKEN), false)
  assert.deepEqual(
    calls.map((call) => call.path),
    ["/api/get-clients", "/api/get-plans", "/api/modify-client", "/api/get-clients"]
  )
  assert.deepEqual(Object.keys(calls[2].body).sort(), ["id_plan", "identificador"])
  assert.equal(calls[2].body.id_plan, PACK_ID)
  assert.equal("cantidad_dispositivos" in calls[2].body, false)
  assert.equal("macs" in calls[2].body, false)
})

test("11 y 16-17. un cliente suspendido cambia el plan y sigue suspendido", async () => {
  let lookups = 0
  const { result, calls } = await change("pack", "4402", (path) => {
    if (path === "/api/get-clients") {
      lookups += 1
      return jsonResponse(
        clientRecord("4402", 0, lookups === 1 ? BASIC_ID : PACK_ID, lookups === 1 ? "Plan Basico" : "Plan Basico + Pack Futbol")
      )
    }
    if (path === "/api/get-plans") return jsonResponse(catalog())
    if (path === "/api/modify-client") return jsonResponse({ code: 1 })
    throw new Error(path)
  })
  assert.equal(result.outcome, "updated")
  assert.equal(result.status, "disabled")
  assert.equal(calls.some((call) => call.path === "/api/enable-client"), false)
  assert.equal(calls.some((call) => call.path === "/api/disable-client"), false)
})

test("12. un cliente inexistente no escribe", async () => {
  const { result, calls } = await change("pack", "4403", (path) => {
    if (path === "/api/get-clients") return jsonResponse({ code: 3 })
    throw new Error(path)
  })
  assert.equal(result.outcome, "not_found")
  assert.match(result.message, /No se puede cambiar el plan/)
  assert.deepEqual(calls.map((call) => call.path), ["/api/get-clients"])
})

test("13 y 27. sin Plan Full no se escribe", async () => {
  const { result, calls } = await change("full", "4404", (path) => {
    if (path === "/api/get-clients") return jsonResponse(clientRecord("4404", 1, BASIC_ID, "Plan Basico"))
    if (path === "/api/get-plans") return jsonResponse(catalog())
    throw new Error(path)
  })
  assert.equal(result.outcome, "plan_missing")
  assert.match(result.message, /TV Full todavía no está disponible/)
  assert.deepEqual(calls.map((call) => call.path), ["/api/get-clients", "/api/get-plans"])
})

test("14. el mismo plan no escribe", async () => {
  const { result, calls } = await change("basica", "4405", (path) => {
    if (path === "/api/get-clients") return jsonResponse(clientRecord("4405", 1, BASIC_ID, "Plan Basico"))
    if (path === "/api/get-plans") return jsonResponse(catalog())
    throw new Error(path)
  })
  assert.equal(result.outcome, "same_plan")
  assert.match(result.message, /ya tiene este plan/)
  assert.equal(calls.some((call) => call.path === "/api/modify-client"), false)
})

test("20. si la reconsulta no confirma el plan, no se inventa", async () => {
  const { result, calls } = await change("pack", "4406", (path) => {
    if (path === "/api/get-clients") return jsonResponse(clientRecord("4406", 1, BASIC_ID, "Plan Basico"))
    if (path === "/api/get-plans") return jsonResponse(catalog())
    if (path === "/api/modify-client") return jsonResponse({ code: 1 })
    throw new Error(path)
  })
  assert.equal(result.outcome, "unverified")
  assert.match(result.message, /no pudimos verificar el nuevo plan/)
  assert.equal(result.planName, "Plan Basico")
  assert.equal(result.planId, BASIC_ID)
  assert.equal(calls.filter((call) => call.path === "/api/get-clients").length, 2)
})

test("21-24. los códigos 3, 5, 6 y 2 no confirman un plan nuevo", async () => {
  const cases = [
    ["4407", 3, "not_found", /No se realizó ningún cambio/],
    ["4408", 5, "plan_missing", /no existe en LATAM TV/],
    ["4409", 6, "rejected", /no pudo asignar el plan/],
    ["4410", 2, "rejected", /no pudo completar el cambio de plan/],
  ]
  for (const [identifier, code, outcome, pattern] of cases) {
    const { result, calls } = await change("pack", identifier, (path) => {
      if (path === "/api/get-clients") return jsonResponse(clientRecord(identifier, 1, BASIC_ID, "Plan Basico"))
      if (path === "/api/get-plans") return jsonResponse(catalog())
      if (path === "/api/modify-client") return jsonResponse({ code, token: TOKEN })
      throw new Error(path)
    })
    assert.equal(result.outcome, outcome)
    assert.match(result.message, pattern)
    assert.equal(result.message.includes(TOKEN), false)
    assert.equal(calls.filter((call) => call.path === "/api/get-clients").length, 1)
  }
})

test("25-26. HTTP y timeout no exponen el token", async () => {
  await assert.rejects(
    () =>
      changeLatamClientPlan("4411", "pack", {
        baseUrl: BASE,
        token: TOKEN,
        fetchImpl: async (url) => {
          const path = new URL(url).pathname
          if (path === "/api/get-clients") return jsonResponse(clientRecord("4411", 1, BASIC_ID, "Plan Basico"))
          if (path === "/api/get-plans") return jsonResponse(catalog())
          return jsonResponse({ token: TOKEN }, 500)
        },
      }),
    (error) => error instanceof LatamTvRequestError && error.message.includes(TOKEN) === false
  )
  await assert.rejects(
    () =>
      changeLatamClientPlan("4412", "pack", {
        baseUrl: BASE,
        token: TOKEN,
        fetchImpl: async (url) => {
          const path = new URL(url).pathname
          if (path === "/api/get-clients") return jsonResponse(clientRecord("4412", 1, BASIC_ID, "Plan Basico"))
          if (path === "/api/get-plans") return jsonResponse(catalog())
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

test("28-29. con Plan Full en el catálogo el cambio usa ese id", async () => {
  let lookups = 0
  const { result, calls } = await change("full", "4413", (path) => {
    if (path === "/api/get-clients") {
      lookups += 1
      return jsonResponse(
        clientRecord("4413", 1, lookups === 1 ? BASIC_ID : FULL_ID, lookups === 1 ? "Plan Basico" : "Plan Full")
      )
    }
    if (path === "/api/get-plans") {
      return jsonResponse(catalog([{ pl_id: FULL_ID, nombre: "Plan Full", categorias: [] }]))
    }
    if (path === "/api/modify-client") return jsonResponse({ code: 1 })
    throw new Error(path)
  })
  assert.equal(result.outcome, "updated")
  assert.equal(result.planId, FULL_ID)
  assert.equal(calls.find((call) => call.path === "/api/modify-client").body.id_plan, FULL_ID)
})

test("31-35. tenant, doble envío y ninguna otra operación", async () => {
  assert.deepEqual(
    latamIdentifierFromCustomer(
      { companyId: "otra-empresa", externalCustomerCode: "00004401" },
      "empresa-actual"
    ),
    { status: "not_found" }
  )
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
        const count = calls.filter((item) => item === "/api/get-clients").length
        return jsonResponse(
          clientRecord("4414", 1, count === 1 ? BASIC_ID : PACK_ID, count === 1 ? "Plan Basico" : "Plan Basico + Pack Futbol")
        )
      }
      if (path === "/api/get-plans") return jsonResponse(catalog())
      if (path === "/api/modify-client") return jsonResponse({ code: 1 })
      throw new Error(path)
    },
  }
  const first = changeLatamClientPlan("4414", "pack", deps)
  await new Promise((resolve) => setImmediate(resolve))
  const second = await changeLatamClientPlan("4414", "basica", deps)
  assert.equal(second.outcome, "busy")
  release()
  assert.equal((await first).outcome, "updated")
  assert.deepEqual(calls, ["/api/get-clients", "/api/get-plans", "/api/modify-client", "/api/get-clients"])

  const route = read("app/api/integrations/latam-tv/customers/[customerId]/plan/route.ts")
  const dialog = read("components/subscriptions/latam-tv-row-dialog.tsx")
  const moduleUi = read("components/subscriptions/subscriptions-module.tsx")
  const audit = read("lib/integrations/latam-tv/password-audit.ts")
  assert.match(route, /requireSubscriptionsWriteContext/)
  assert.match(route, /\.eq\("company_id", auth\.companyId\)/)
  assert.match(route, /changeLatamClientPlan/)
  assert.doesNotMatch(route, /create-plan|enable-client|isp_services|monthly_fee/)
  assert.match(dialog, /El cambio se aplicará en LATAM y luego se actualizará el padrón de Bespoke\./)
  assert.doesNotMatch(moduleUi, /Cambiar plan de TV/)
  assert.match(dialog, /payload\?\.outcome === "updated" && confirmed && selectedPlan/)
  assert.match(dialog, /onPadronPlan\(row, selectedPlan\.kind\)/)
  assert.match(dialog, /El estado del cliente no se modificará\./)
  assert.match(dialog, /El cliente continuará suspendido después del cambio\./)
  assert.match(dialog, /TV Full — No disponible actualmente en LATAM/)
  assert.doesNotMatch(dialog, /id_plan/)
  assert.doesNotMatch(dialog, /\/api\/modify-client/)
  assert.doesNotMatch(moduleUi, /\/api\/modify-client/)
  assert.match(audit, /change_plan/)
  assert.match(audit, /previousPlan/)
  assert.match(audit, /requestedPlan/)
})

test("el cambio confirmado en LATAM y Bespoke cierra con éxito", () => {
  const dialog = read("components/subscriptions/latam-tv-row-dialog.tsx")
  const submitStart = dialog.indexOf("async function submitPlan()")
  const submitEnd = dialog.indexOf("const label = statusLabel(phase)")
  const submit = dialog.slice(submitStart, submitEnd)
  const updated = submit.indexOf('payload?.outcome === "updated" && confirmed && selectedPlan')
  const padron = submit.indexOf("onPadronPlan(row, selectedPlan.kind)")
  const bespokeError = submit.indexOf("if (padronError)")
  const success = submit.indexOf('setPhase("plan_done")')
  const latamError = submit.indexOf("No fue posible comunicarse con LATAM TV. No se realizaron cambios en Bespoke.")
  assert.ok(updated >= 0 && padron > updated && bespokeError > padron && success > bespokeError)
  assert.ok(latamError > success)
  assert.match(submit.slice(bespokeError, success), /setActionError\(padronError\)/)
  assert.match(submit.slice(bespokeError, success), /return/)
  assert.match(dialog, /planDoneRef\.current && row && intent === "plan"/)
  assert.match(dialog, /Plan cambiado con éxito/)
  assert.match(dialog, /El plan de TV se actualizó correctamente en LATAM y Bespoke\./)
  const doneFooter = dialog.slice(
    dialog.indexOf(') : phase === "plan_done" ? ('),
    dialog.indexOf(') : phase === "plan_confirm" ? (')
  )
  assert.match(doneFooter, /onClick=\{onClose\}/)
  assert.match(doneFooter, /Cerrar/)
  assert.doesNotMatch(doneFooter, /Cancelar/)
  assert.doesNotMatch(doneFooter, /Planes disponibles/)
  assert.doesNotMatch(doneFooter, /Cambiar plan/)
  const doneBody = dialog.slice(
    dialog.indexOf('{phase === "plan_done" ? ('),
    dialog.indexOf('{phase === "plan_confirm" && selectedPlan')
  )
  assert.match(doneBody, /El plan de TV se actualizó correctamente en LATAM y Bespoke\./)
  assert.doesNotMatch(doneBody, /Planes disponibles/)
  assert.doesNotMatch(doneBody, /Cancelar/)
})
