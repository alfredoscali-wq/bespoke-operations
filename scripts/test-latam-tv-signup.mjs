/**
 * Alta LATAM desde TV & Suscripciones.
 * Usuario = email. Contraseña inicial = DNI. No llama a la API real.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { signUpLatamTvClient } from "../lib/integrations/latam-tv/client.ts"
import { LatamTvRequestError } from "../lib/integrations/latam-tv/errors.ts"
import {
  LATAM_SIGNUP_MISSING,
  assessLatamSignup,
  latamInitialPassword,
  latamPlanIdForTvKind,
  latamRegisterRejectionMessage,
  latamStatusLabel,
} from "../lib/integrations/latam-tv/signup.ts"

const root = resolve(import.meta.dirname, "..")
const TOKEN = "latam-signup-token-do-not-leak"
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

function readyCustomer(overrides = {}) {
  return {
    name: "Ada Lovelace",
    dni: "30.123.456",
    email: "cliente@email.com",
    phone: "3515551234",
    address: "Calle 10",
    identifier: "00006797",
    tvKind: "basica",
    planId: "latam-plan-99",
    ...overrides,
  }
}

function readyBody(overrides = {}) {
  const assessment = assessLatamSignup(readyCustomer(overrides))
  assert.equal(assessment.ready, true)
  if (!assessment.ready) throw new Error("alta no lista")
  return assessment
}

test("1-4. estado LATAM: no registrado, activo, suspendido y error", () => {
  assert.equal(latamStatusLabel({ kind: "unregistered" }), "LATAM: No registrado")
  assert.equal(
    latamStatusLabel({ kind: "registered", status: "enabled" }),
    "LATAM: Activo"
  )
  assert.equal(
    latamStatusLabel({ kind: "registered", status: "disabled" }),
    "LATAM: Suspendido"
  )
  assert.equal(latamStatusLabel({ kind: "unavailable" }), "LATAM: No disponible")
  assert.equal(
    latamStatusLabel({ kind: "registered", status: null }),
    "LATAM: No disponible"
  )
  assert.notEqual(
    latamStatusLabel({ kind: "unavailable" }),
    "LATAM: No registrado"
  )
})

test("5-9. alta usa email, DNI, identificador y el id de plan recibido", () => {
  assert.equal(latamInitialPassword("30.123.456"), "30123456")
  assert.equal(latamInitialPassword("cliente@email.com"), null)
  const assessment = readyBody()
  assert.equal(assessment.body.correo, "cliente@email.com")
  assert.equal(assessment.body.password, "30123456")
  assert.notEqual(assessment.body.password, assessment.body.correo)
  assert.equal(assessment.body.identificador, "6797")
  assert.equal(assessment.body.plan, "latam-plan-99")
  assert.equal(assessment.body.nombres, "Ada")
  assert.equal(assessment.body.apellido, "Lovelace")
  assert.equal(assessment.body.dni, "30123456")
  assert.equal(assessment.preview.username, assessment.body.correo)
  assert.equal(assessment.preview.initialPassword, assessment.body.password)
  assert.equal(assessment.preview.planLabel, "TV Básica")
  assert.equal("dispositivos" in assessment.body, false)
  assert.equal("fecha_nacimiento" in assessment.body, false)
  assert.equal("token" in assessment.body, false)
  assert.equal(assessment.body.plan === "TV Básica", false)
  assert.equal(assessment.body.plan === "basica", false)
  assert.equal(assessment.body.plan === "4500", false)
})

test("10. si el identificador ya existe no se llama a register-client", async () => {
  const assessment = readyBody()
  let registered = false
  const result = await signUpLatamTvClient(assessment.body, {
    baseUrl: BASE,
    token: TOKEN,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/register-client") {
        registered = true
        return jsonResponse({ code: 1 })
      }
      return jsonResponse({
        code: 1,
        clients: [{ identificador: "6797", id_crm: "6797", status: 0 }],
      })
    },
  })
  assert.equal(registered, false)
  assert.equal(result.outcome, "already_exists")
  if (result.outcome === "already_exists") assert.equal(result.status, "disabled")
})

test("11. sin correspondencia de plan no hay alta", () => {
  assert.equal(latamPlanIdForTvKind("basica"), null)
  assert.equal(latamPlanIdForTvKind("pack"), null)
  assert.equal(latamPlanIdForTvKind("full"), null)
  assert.equal(latamPlanIdForTvKind("other"), null)
  const blocked = assessLatamSignup(readyCustomer({ planId: null }))
  assert.equal(blocked.ready, false)
  if (blocked.ready) return
  assert.ok(blocked.missing.includes(LATAM_SIGNUP_MISSING.plan))
  assert.equal("body" in blocked, false)
})

test("12. code 2, 4, 5, 6 y 13 quedan interpretados", async () => {
  assert.equal(
    latamRegisterRejectionMessage(2),
    "LATAM TV no pudo completar el alta."
  )
  assert.equal(
    latamRegisterRejectionMessage(3),
    "El cliente ya existe en LATAM TV."
  )
  assert.equal(
    latamRegisterRejectionMessage(4),
    "LATAM indicó un dispositivo vinculado a otro usuario."
  )
  assert.equal(latamRegisterRejectionMessage(5), "El plan no existe en LATAM TV.")
  assert.equal(latamRegisterRejectionMessage(6), "LATAM no pudo vincular el plan.")
  assert.equal(
    latamRegisterRejectionMessage(13),
    "LATAM no pudo vincular el dispositivo."
  )

  const assessment = readyBody({ identifier: "6801" })
  const result = await signUpLatamTvClient(assessment.body, {
    baseUrl: BASE,
    token: TOKEN,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/get-clients") return jsonResponse({ code: 3 })
      return jsonResponse({ code: 2, token: TOKEN, password: assessment.body.password })
    },
  })
  assert.equal(result.outcome, "rejected")
  if (result.outcome !== "rejected") return
  assert.equal(result.message, "LATAM TV no pudo completar el alta.")
  assert.equal(result.message.includes(TOKEN), false)
  assert.equal(result.message.includes(assessment.body.password), false)
})

test("13. dos altas simultáneas consultan de nuevo y crean una sola vez", async () => {
  const assessment = readyBody({ identifier: "6802" })
  let registers = 0
  let phase = "empty"
  const fetchImpl = async (url, init) => {
    const path = new URL(url).pathname
    if (path === "/api/get-clients") {
      if (phase === "empty") await new Promise((resolve) => setTimeout(resolve, 30))
      return jsonResponse(
        phase === "created"
          ? { code: 1, clients: [{ identificador: "6802", id_crm: "6802", status: 1 }] }
          : { code: 3 }
      )
    }
    assert.equal(path, "/api/register-client")
    registers += 1
    const body = JSON.parse(init.body)
    assert.equal(body.correo, "cliente@email.com")
    assert.equal(body.password, "30123456")
    assert.equal(body.identificador, "6802")
    assert.equal(body.plan, "latam-plan-99")
    assert.equal(new URL(url).searchParams.get("token"), TOKEN)
    assert.equal(body.token, undefined)
    phase = "created"
    return jsonResponse({ code: 1, token: TOKEN, password: body.password })
  }
  const [first, second] = await Promise.all([
    signUpLatamTvClient(assessment.body, { baseUrl: BASE, token: TOKEN, fetchImpl }),
    signUpLatamTvClient(assessment.body, { baseUrl: BASE, token: TOKEN, fetchImpl }),
  ])
  assert.equal(registers, 1)
  assert.deepEqual([first.outcome, second.outcome].sort(), ["already_exists", "created"])
  assert.equal(JSON.stringify(first).includes(TOKEN), false)
  assert.equal(JSON.stringify(second).includes(TOKEN), false)
  assert.equal(JSON.stringify(first).includes("30123456"), false)
  assert.equal(JSON.stringify(second).includes("30123456"), false)
})

test("14-16. faltan email, DNI o identificador", () => {
  const noEmail = assessLatamSignup(readyCustomer({ email: "  " }))
  const noDni = assessLatamSignup(readyCustomer({ dni: "12" }))
  const noIdentifier = assessLatamSignup(readyCustomer({ identifier: "0" }))
  assert.equal(noEmail.ready, false)
  assert.equal(noDni.ready, false)
  assert.equal(noIdentifier.ready, false)
  if (!noEmail.ready) assert.ok(noEmail.missing.includes("Email"))
  if (!noDni.ready) assert.ok(noDni.missing.includes("DNI"))
  if (!noIdentifier.ready) assert.ok(noIdentifier.missing.includes("N° ABNet"))
})

test("17-20. el token no sale al frontend ni a los logs, y solo se registra", () => {
  const client = read("lib/integrations/latam-tv/client.ts")
  const signup = read("lib/integrations/latam-tv/signup.ts")
  const lookup = read("app/api/integrations/latam-tv/customers/[customerId]/route.ts")
  const route = read(
    "app/api/integrations/latam-tv/customers/[customerId]/register/route.ts"
  )
  const dialog = read("components/subscriptions/latam-tv-row-dialog.tsx")
  const moduleUi = read("components/subscriptions/subscriptions-module.tsx")
  const paths = ["/api/delete-client", "/api/disable-client", "/api/enable-client", "/api/modify-client"]

  assert.match(signup, /usuario de LATAM es el email/)
  assert.match(signup, /contraseña inicial es el DNI/)
  assert.doesNotMatch(client, /console\./)
  assert.doesNotMatch(signup, /console\./)
  for (const file of [client, route, dialog, moduleUi, lookup]) {
    for (const path of paths) assert.equal(file.includes(path), false)
    assert.equal(file.includes(TOKEN), false)
  }
  assert.equal(client.includes("/api/modify-password"), true)
  for (const file of [route, dialog, moduleUi, lookup]) {
    assert.equal(file.includes("/api/modify-password"), false)
  }
  assert.match(client, /\/api\/get-clients/)
  assert.match(client, /\/api\/get-plans/)
  assert.match(client, /\/api\/register-client/)
  assert.match(route, /signUpLatamTvClient/)
  assert.match(route, /requireSubscriptionsWriteContext/)
  assert.match(route, /\.eq\("company_id", auth\.companyId\)/)
  assert.match(route, /\.eq\("id", customerId\)/)
  assert.match(route, /getLatamTvPlans\(config\)/)
  assert.match(route, /latamPlanIdForTvKind\(input\.tvKind, diagnosis\)/)
  assert.doesNotMatch(route, /record\.planId/)
  assert.doesNotMatch(route, /\.insert\(/)
  assert.doesNotMatch(route, /\.update\(/)
  assert.doesNotMatch(route, /searchParams\.get\("companyId"\)/)
  assert.doesNotMatch(route, /console\.(log|info|debug|warn|error)\([^)]*\$\{/)
  assert.doesNotMatch(route, /console\.(log|info|debug|warn|error)\([^)]*initialPassword/)
  assert.doesNotMatch(route, /console\.(log|info|debug|warn|error)\([^)]*assessment/)
  const readyAt = route.indexOf("if (!assessment.ready)")
  const signupAt = route.indexOf("await signUpLatamTvClient")
  assert.ok(readyAt > 0 && signupAt > readyAt)

  assert.doesNotMatch(dialog, /LATAM_TV_API_TOKEN/)
  assert.doesNotMatch(moduleUi, /LATAM_TV_API_TOKEN/)
  assert.doesNotMatch(dialog, /planId/)
  assert.match(dialog, /\/api\/integrations\/latam-tv\/customers\//)
  assert.match(dialog, /tvKind: row\.tvKind/)
  assert.match(dialog, /Se creará este usuario en LATAM TV utilizando el email como usuario y el DNI como contraseña inicial/)
  assert.match(dialog, /Cliente dado de alta correctamente en LATAM TV/)
  assert.doesNotMatch(moduleUi, /fetch\(/)
  assert.doesNotMatch(moduleUi, /<Eye /)
  assert.doesNotMatch(moduleUi, /function AbnetPadronContact/)
})

test("un error de red del alta no incluye el token ni la contraseña", async () => {
  const assessment = readyBody({ identifier: "6803" })
  await assert.rejects(
    () =>
      signUpLatamTvClient(assessment.body, {
        baseUrl: BASE,
        token: TOKEN,
        fetchImpl: async (url) => {
          const path = new URL(url).pathname
          if (path === "/api/get-clients") return jsonResponse({ code: 3 })
          throw new Error(`network ${TOKEN} ${assessment.body.password} ${url}`)
        },
      }),
    (error) => {
      assert.ok(error instanceof LatamTvRequestError)
      assert.equal(error.message.includes(TOKEN), false)
      assert.equal(error.message.includes(assessment.body.password), false)
      assert.equal(error.message.includes("abnetv"), false)
      return true
    }
  )
})

test("code 3 de register-client no vuelve a crear", async () => {
  const assessment = readyBody({ identifier: "6804" })
  let registers = 0
  const result = await signUpLatamTvClient(assessment.body, {
    baseUrl: BASE,
    token: TOKEN,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/get-clients") return jsonResponse({ code: 3 })
      registers += 1
      return jsonResponse({ code: 3 })
    },
  })
  assert.equal(registers, 1)
  assert.equal(result.outcome, "already_exists")
})
