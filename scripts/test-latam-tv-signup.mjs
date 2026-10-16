/**
 * Alta LATAM desde TV & Suscripciones.
 * Usuario = email. Contraseña inicial = DNI. No llama a la API real.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  findConfirmedLatamIdentifier,
  refreshLatamSignupIdentity,
  signUpLatamTvClient,
} from "../lib/integrations/latam-tv/client.ts"
import { LatamTvRequestError } from "../lib/integrations/latam-tv/errors.ts"
import { latamSignupRejectionReleasesAttempt } from "../lib/integrations/latam-tv/signup-attempt.ts"
import {
  LATAM_SIGNUP_MISSING,
  LATAM_SIGNUP_MISSING_BOTH,
  LATAM_SIGNUP_MISSING_DNI,
  LATAM_SIGNUP_MISSING_EMAIL,
  assessLatamSignup,
  latamSignupCredentialGap,
  latamSignupCredentialMessage,
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
  const byCli = assessLatamSignup(
    readyCustomer({ identifier: null, identitySignup: true })
  )
  assert.equal(byCli.ready, true)
  if (byCli.ready) {
    assert.equal("identificador" in byCli.body, false)
    assert.equal(byCli.body.password, "30123456")
    assert.equal(byCli.body.correo, "cliente@email.com")
    assert.notEqual(byCli.body.password, "CLI-005788")
    assert.notEqual(byCli.body.identificador, "5788")
    assert.notEqual(byCli.body.identificador, "CLI-005788")
  }
  const cliAsIdentifier = assessLatamSignup(readyCustomer({ identifier: "CLI-005788" }))
  assert.equal(cliAsIdentifier.ready, false)
  if (!cliAsIdentifier.ready) {
    assert.ok(cliAsIdentifier.missing.includes("N° ABNet"))
  }
  assert.equal(latamSignupCredentialGap("30123456", "cliente@email.com"), null)
  assert.equal(latamSignupCredentialGap("30123456", ""), "email")
  assert.equal(latamSignupCredentialGap("12", "cliente@email.com"), "dni")
  assert.equal(latamSignupCredentialGap("", ""), "both")
  assert.equal(latamSignupCredentialMessage("email"), LATAM_SIGNUP_MISSING_EMAIL)
  assert.equal(latamSignupCredentialMessage("dni"), LATAM_SIGNUP_MISSING_DNI)
  assert.equal(latamSignupCredentialMessage("both"), LATAM_SIGNUP_MISSING_BOTH)
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
  const paths = ["/api/delete-client"]

  assert.match(signup, /usuario de LATAM es el email/)
  assert.match(signup, /contraseña inicial es el DNI/)
  assert.doesNotMatch(client, /console\./)
  assert.doesNotMatch(signup, /console\./)
  for (const file of [client, route, dialog, moduleUi, lookup]) {
    for (const path of paths) assert.equal(file.includes(path), false)
    assert.equal(file.includes(TOKEN), false)
  }
  assert.equal(client.includes("/api/modify-password"), true)
  assert.equal(client.includes("/api/disable-client"), true)
  assert.equal(client.includes("/api/enable-client"), true)
  assert.equal(client.includes("/api/modify-client"), true)
  for (const file of [route, dialog, moduleUi, lookup]) {
    assert.equal(file.includes("/api/modify-password"), false)
    assert.equal(file.includes("/api/disable-client"), false)
    assert.equal(file.includes("/api/enable-client"), false)
    assert.equal(file.includes("/api/modify-client"), false)
  }
  assert.match(client, /\/api\/get-clients/)
  assert.match(client, /\/api\/get-plans/)
  assert.match(client, /\/api\/register-client/)
  assert.match(route, /signUpLatamTvClient/)
  assert.match(route, /refreshLatamSignupIdentity/)
  assert.match(route, /createLatamSignupAttemptStore/)
  assert.doesNotMatch(route, /identitySignupHolds/)
  const attemptSql = read("supabase/migrations/20270115190000_latam_tv_signup_attempts.sql")
  assert.doesNotMatch(attemptSql, /\b(dni|email|password|correo)\b/i)
  assert.match(attemptSql, /PRIMARY KEY \(company_id, customer_id\)/)
  assert.match(attemptSql, /ON CONFLICT \(company_id, customer_id\)/)
  assert.match(attemptSql, /WHERE latam_tv_signup_attempts\.state = 'rejected'/)
  assert.match(route, /input\.retry/)
  assert.match(read("app/api/integrations/latam-tv/customers/[customerId]/plan/route.ts"), /findConfirmedLatamIdentifier/)
  assert.match(read("app/api/integrations/latam-tv/customers/[customerId]/status/route.ts"), /findConfirmedLatamIdentifier/)
  assert.match(read("app/api/integrations/latam-tv/customers/[customerId]/password/route.ts"), /findConfirmedLatamIdentifier/)
  assert.match(dialog, /pending_sync/)
  assert.match(dialog, /retry/)
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
  assert.doesNotMatch(route, /initialPassword/)
  assert.match(route, /latamSignupCredentialMessage/)
  assert.doesNotMatch(route, /console\.(log|info|debug|warn|error)\([^)]*assessment/)
  const readyAt = route.indexOf("if (!assessment.ready)")
  const signupAt = route.indexOf("await signUpLatamTvClient")
  const credentialAt = route.indexOf("latamSignupCredentialGap")
  assert.ok(credentialAt > 0 && credentialAt < signupAt)
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

test("el alta no habilita acciones si la reconsulta no confirma el id_crm", async () => {
  const assessment = readyBody({ identifier: "6805" })
  let registers = 0
  const result = await signUpLatamTvClient(assessment.body, {
    baseUrl: BASE,
    token: TOKEN,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/get-clients") return jsonResponse({ code: 3 })
      registers += 1
      return jsonResponse({ code: 1 })
    },
  })
  assert.equal(registers, 1)
  assert.equal(result.outcome, "unverified")
  if (result.outcome === "unverified") {
    assert.equal(result.message.includes(TOKEN), false)
    assert.equal(result.message.includes(assessment.body.password), false)
  }
})

function attemptStore(initial = null, code = null) {
  const box = { state: initial, code, failFinish: 0, finishCalls: 0 }
  let chain = Promise.resolve()
  const exclusive = (run) => {
    const next = chain.then(run, run)
    chain = next.then(
      () => {},
      () => {}
    )
    return next
  }
  return {
    box,
    reserve: () =>
      exclusive(async () => {
        if (box.state == null || box.state === "rejected") {
          box.state = "register_sent"
          box.code = null
          return { granted: true, state: "register_sent" }
        }
        return { granted: false, state: box.state }
      }),
    read: () => exclusive(async () => box.state),
    finish: (state, latamCode = null) =>
      exclusive(async () => {
        box.finishCalls += 1
        if (box.failFinish > 0) {
          box.failFinish -= 1
          return "unavailable"
        }
        const from = box.state
        const allowed =
          from != null &&
          state !== "rejected" &&
          ((from === "register_sent" && (state === "pending_sync" || state === "confirmed")) ||
            (from === "pending_sync" && (state === "pending_sync" || state === "confirmed")) ||
            (from === "confirmed" && state === "confirmed"))
        if (!allowed) return "unavailable"
        if (from === "confirmed") {
          if (box.code == null && latamCode != null) box.code = latamCode
        } else {
          box.code = latamCode ?? box.code
        }
        box.state = state
        return "saved"
      }),
    release: () =>
      exclusive(async () => {
        if (box.state !== "pending_sync") return "blocked"
        if (box.code === 1 || box.code === 3) return "blocked"
        box.state = "rejected"
        return "released"
      }),
  }
}

function martaAssessment() {
  return readyBody({
    name: "Marta Nieto",
    identifier: null,
    identitySignup: true,
    dni: "30.123.456",
    email: "marta@example.com",
  })
}

function hidalgoRow() {
  return {
    identificador: "5788",
    id_crm: "5788",
    id_iptv: 12,
    dni: "20999888",
    usuario: "marisa@example.com",
    status: 1,
    nombres: "Marisa",
    apellido: "Hidalgo",
  }
}

function martaRow(overrides = {}) {
  return {
    id_crm: null,
    id_iptv: 29,
    dni: "30123456",
    usuario: "marta@example.com",
    status: 1,
    nombres: "Marta",
    apellido: "Nieto",
    ...overrides,
  }
}

test("alta nueva no envía CLI-005788 y recupera el identificador de Latam", async () => {
  const assessment = martaAssessment()
  const store = attemptStore()
  assert.equal("identificador" in assessment.body, false)
  let registers = 0
  let listed = false
  const result = await signUpLatamTvClient(assessment.body, {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: store,
    fetchImpl: async (url, init) => {
      const path = new URL(url).pathname
      if (path === "/api/get-clients") {
        const clients = listed
          ? [hidalgoRow(), martaRow({ identificador: "4412" })]
          : [hidalgoRow()]
        return jsonResponse({ code: 1, clients })
      }
      registers += 1
      const body = JSON.parse(init.body)
      assert.equal("identificador" in body, false)
      assert.equal(body.correo, "marta@example.com")
      assert.equal(body.password, "30123456")
      assert.equal(JSON.stringify(body).includes("5788"), false)
      assert.equal(JSON.stringify(body).includes("CLI-005788"), false)
      listed = true
      return jsonResponse({ code: 1 })
    },
  })
  assert.equal(registers, 1)
  assert.equal(result.outcome, "created")
  if (result.outcome === "created") {
    assert.equal(result.identifier, "4412")
    assert.notEqual(result.identifier, "5788")
    assert.equal(JSON.stringify(result).includes("30123456"), false)
  }
  assert.equal(store.box.state, "confirmed")
})

test("sin identificador en la respuesta el alta queda pendiente de sincronización", async () => {
  const assessment = martaAssessment()
  const store = attemptStore()
  let registers = 0
  let listed = false
  const result = await signUpLatamTvClient(assessment.body, {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: store,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/get-clients") {
        const clients = listed ? [hidalgoRow(), martaRow()] : [hidalgoRow()]
        return jsonResponse({ code: 1, clients })
      }
      registers += 1
      listed = true
      return jsonResponse({ code: 1, id_iptv: 29, id_crm: null })
    },
  })
  assert.equal(registers, 1)
  assert.equal(result.outcome, "pending_sync")
  assert.equal(JSON.stringify(result).includes("5788"), false)
  assert.equal(JSON.stringify(result).includes("30123456"), false)
  assert.equal(store.box.state, "pending_sync")
})

test("la respuesta con identificador se vincula solo si DNI y email coinciden", async () => {
  const assessment = martaAssessment()
  const store = attemptStore()
  let registers = 0
  const result = await signUpLatamTvClient(assessment.body, {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: store,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/get-clients") return jsonResponse({ code: 1, clients: [hidalgoRow()] })
      registers += 1
      return jsonResponse({
        code: 1,
        identificador: "4412",
        id_iptv: 29,
        id_crm: "5788",
        dni: "30123456",
        usuario: "marta@example.com",
        status: 1,
      })
    },
  })
  assert.equal(registers, 1)
  assert.equal(result.outcome, "created")
  if (result.outcome === "created") {
    assert.equal(result.identifier, "4412")
    assert.notEqual(result.identifier, "5788")
  }
  const again = await signUpLatamTvClient(assessment.body, {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: store,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/get-clients") return jsonResponse({ code: 1, clients: [hidalgoRow()] })
      registers += 1
      return jsonResponse({ code: 1 })
    },
  })
  assert.equal(registers, 1)
  assert.equal(again.outcome, "pending_sync")
  assert.equal(store.box.state, "confirmed")
})

test("coincidencia ambigua no crea otro usuario", async () => {
  const assessment = martaAssessment()
  let registers = 0
  const result = await signUpLatamTvClient(assessment.body, {
    baseUrl: BASE,
    token: TOKEN,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/register-client") registers += 1
      return jsonResponse({
        code: 1,
        clients: [
          martaRow({ identificador: "4412" }),
          martaRow({ identificador: "4413", id_iptv: 30 }),
        ],
      })
    },
  })
  assert.equal(registers, 0)
  assert.equal(result.outcome, "rejected")
})

test("reconsulta no vuelve a crear el usuario y recupera el identificador", async () => {
  const assessment = martaAssessment()
  let registers = 0
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname
    if (path === "/api/register-client") registers += 1
    return jsonResponse({
      code: 1,
      clients: [hidalgoRow(), martaRow({ identificador: "4412" })],
    })
  }
  const store = attemptStore()
  const deps = { baseUrl: BASE, token: TOKEN, fetchImpl, signupAttempt: store }
  const first = await signUpLatamTvClient(assessment.body, deps)
  const second = await refreshLatamSignupIdentity(assessment.body, deps)
  const identifier = await findConfirmedLatamIdentifier(
    { dni: "30.123.456", email: "marta@example.com" },
    deps
  )
  assert.equal(registers, 0)
  assert.equal(first.outcome, "already_exists")
  assert.equal(second.outcome, "already_exists")
  if (first.outcome === "already_exists") assert.equal(first.identifier, "4412")
  assert.equal(identifier, "4412")
  assert.notEqual(identifier, "5788")
  assert.equal(store.box.state, null)
  assert.equal(store.box.finishCalls, 0)
})

test("id_crm 5788 sin identificador explícito no vincula a Marta", async () => {
  const assessment = martaAssessment()
  const deps = {
    baseUrl: BASE,
    token: TOKEN,
    fetchImpl: async () =>
      jsonResponse({
        code: 1,
        clients: [hidalgoRow(), martaRow({ id_crm: "5788" })],
      }),
  }
  const result = await refreshLatamSignupIdentity(assessment.body, deps)
  const identifier = await findConfirmedLatamIdentifier(
    { dni: "30123456", email: "marta@example.com" },
    deps
  )
  assert.equal(result.outcome, "pending_sync")
  assert.equal(identifier, null)
})

test("pending_sync no vuelve a llamar a register-client", async () => {
  const assessment = martaAssessment()
  let registers = 0
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname
    if (path === "/api/get-clients") {
      return jsonResponse({ code: 1, clients: [hidalgoRow()] })
    }
    registers += 1
    return jsonResponse({ code: 1 })
  }
  const store = attemptStore()
  const deps = { baseUrl: BASE, token: TOKEN, fetchImpl, signupAttempt: store }
  const first = await signUpLatamTvClient(assessment.body, deps)
  const second = await signUpLatamTvClient(assessment.body, deps)
  const refresh = await refreshLatamSignupIdentity(assessment.body, deps)
  assert.equal(registers, 1)
  assert.equal(first.outcome, "pending_sync")
  assert.equal(second.outcome, "pending_sync")
  assert.equal(refresh.outcome, "pending_sync")
  assert.equal(JSON.stringify(second).includes("30123456"), false)
  assert.equal(store.box.state, "pending_sync")
})

test("una respuesta de red incierta no repite la creación", async () => {
  const assessment = martaAssessment()
  let registers = 0
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname
    if (path === "/api/get-clients") {
      return jsonResponse({ code: 1, clients: [hidalgoRow()] })
    }
    registers += 1
    throw new Error(`network ${TOKEN} ${assessment.body.password}`)
  }
  const store = attemptStore()
  const deps = { baseUrl: BASE, token: TOKEN, fetchImpl, signupAttempt: store }
  const first = await signUpLatamTvClient(assessment.body, deps)
  const second = await signUpLatamTvClient(assessment.body, deps)
  assert.equal(registers, 1)
  assert.equal(first.outcome, "pending_sync")
  assert.equal(second.outcome, "pending_sync")
  assert.equal(store.box.state, "pending_sync")
  assert.equal(JSON.stringify(first).includes(TOKEN), false)
  assert.equal(JSON.stringify(first).includes(assessment.body.password), false)
  assert.equal(JSON.stringify(second).includes(TOKEN), false)
})

test("dos altas concurrentes de la misma ficha crean un solo usuario", async () => {
  const assessment = martaAssessment()
  let registers = 0
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname
    if (path === "/api/get-clients") {
      return jsonResponse({ code: 1, clients: [hidalgoRow()] })
    }
    registers += 1
    await new Promise((resolve) => setTimeout(resolve, 30))
    return jsonResponse({ code: 1 })
  }
  const store = attemptStore()
  const deps = { baseUrl: BASE, token: TOKEN, fetchImpl, signupAttempt: store }
  const [first, second] = await Promise.all([
    signUpLatamTvClient(assessment.body, deps),
    signUpLatamTvClient(assessment.body, deps),
  ])
  assert.equal(registers, 1)
  assert.equal(first.outcome, "pending_sync")
  assert.equal(second.outcome, "pending_sync")
  assert.equal(store.box.state, "pending_sync")
})

test("code 3 no confirma un alta nueva y la reconsulta vincula el identificador", async () => {
  const assessment = martaAssessment()
  let registers = 0
  let listed = false
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname
    if (path === "/api/get-clients") {
      const clients = listed
        ? [hidalgoRow(), martaRow({ identificador: "4412" })]
        : [hidalgoRow()]
      return jsonResponse({ code: 1, clients })
    }
    registers += 1
    listed = true
    return jsonResponse({ code: 3 })
  }
  const store = attemptStore()
  const deps = { baseUrl: BASE, token: TOKEN, fetchImpl, signupAttempt: store }
  const first = await signUpLatamTvClient(assessment.body, deps)
  const second = await signUpLatamTvClient(assessment.body, deps)
  assert.equal(registers, 1)
  assert.equal(store.box.state, "confirmed")
  assert.equal(first.outcome, "already_exists")
  assert.notEqual(first.outcome, "created")
  if (first.outcome === "already_exists") {
    assert.equal(first.identifier, "4412")
    assert.notEqual(first.identifier, "5788")
  }
  assert.equal(second.outcome, "already_exists")
})

test("un reinicio con register_sent no vuelve a crear", async () => {
  const assessment = martaAssessment()
  const store = attemptStore("register_sent")
  let registers = 0
  const result = await signUpLatamTvClient(assessment.body, {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: store,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/register-client") registers += 1
      return jsonResponse({ code: 1, clients: [hidalgoRow()] })
    },
  })
  assert.equal(registers, 0)
  assert.equal(result.outcome, "pending_sync")
  assert.equal(store.box.state, "register_sent")
})

test("un reinicio con código 1 solo consulta el padrón", async () => {
  const assessment = martaAssessment()
  const store = attemptStore("pending_sync", 1)
  let registers = 0
  const deps = {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: store,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/register-client") registers += 1
      return jsonResponse({ code: 1, clients: [hidalgoRow()] })
    },
  }
  const result = await refreshLatamSignupIdentity(assessment.body, deps)
  assert.equal(registers, 0)
  assert.equal(result.outcome, "pending_sync")
  assert.equal(store.box.state, "pending_sync")
  assert.equal(store.box.code, 1)
})

test("una consulta sin usuario cierra el intento sin código y no crea otro", async () => {
  const assessment = martaAssessment()
  const store = attemptStore("pending_sync", null)
  let registers = 0
  const deps = {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: store,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/register-client") registers += 1
      return jsonResponse({ code: 1, clients: [hidalgoRow()] })
    },
  }
  const refresh = await refreshLatamSignupIdentity(assessment.body, deps)
  assert.equal(registers, 0)
  assert.equal(refresh.outcome, "failed")
  assert.equal(store.box.state, "rejected")
  assert.equal(JSON.stringify(refresh).includes(assessment.body.password), false)
  assert.equal(JSON.stringify(refresh).includes("5788"), false)
  const again = await signUpLatamTvClient(assessment.body, deps)
  assert.equal(registers, 1)
  assert.equal(again.outcome, "pending_sync")
  assert.equal(store.box.code, 1)
})

test("un código 5 se cierra al confirmar la ausencia y no se reenvía en la consulta", async () => {
  const assessment = martaAssessment()
  const store = attemptStore("pending_sync", 5)
  let registers = 0
  const deps = {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: store,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/register-client") registers += 1
      return jsonResponse({ code: 1, clients: [hidalgoRow()] })
    },
  }
  const refresh = await refreshLatamSignupIdentity(assessment.body, deps)
  assert.equal(registers, 0)
  assert.equal(refresh.outcome, "failed")
  assert.equal(store.box.state, "rejected")
})

test("una coincidencia parcial no cierra el intento ni crea otro usuario", async () => {
  const assessment = martaAssessment()
  const store = attemptStore("pending_sync", null)
  let registers = 0
  const deps = {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: store,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/register-client") registers += 1
      return jsonResponse({
        code: 1,
        clients: [
          hidalgoRow(),
          { dni: "30123456", usuario: "otra@example.com", status: 1, identificador: "9001" },
        ],
      })
    },
  }
  const refresh = await refreshLatamSignupIdentity(assessment.body, deps)
  assert.equal(registers, 0)
  assert.equal(refresh.outcome, "rejected")
  assert.match(refresh.message, /pendiente de confirmación/)
  assert.equal(store.box.state, "pending_sync")
  assert.equal(JSON.stringify(refresh).includes(assessment.body.password), false)
})

test("un código 3 o un padrón ilegible no cierra el intento", async () => {
  const assessment = martaAssessment()
  const kept = attemptStore("pending_sync", 3)
  const keptDeps = {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: kept,
    fetchImpl: async () => jsonResponse({ code: 1, clients: [hidalgoRow()] }),
  }
  const keptResult = await refreshLatamSignupIdentity(assessment.body, keptDeps)
  assert.equal(keptResult.outcome, "pending_sync")
  assert.equal(kept.box.state, "pending_sync")

  const unread = attemptStore("pending_sync", null)
  const unreadDeps = {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: unread,
    fetchImpl: async () => jsonResponse({ code: 2 }),
  }
  await assert.rejects(() => refreshLatamSignupIdentity(assessment.body, unreadDeps))
  assert.equal(unread.box.state, "pending_sync")
})

test("una consulta no degrada un intento confirmado", async () => {
  const assessment = martaAssessment()
  const store = attemptStore("confirmed", 1)
  let registers = 0
  const deps = {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: store,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/register-client") registers += 1
      return jsonResponse({ code: 1, clients: [hidalgoRow()] })
    },
  }
  const refresh = await refreshLatamSignupIdentity(assessment.body, deps)
  assert.equal(registers, 0)
  assert.equal(refresh.outcome, "pending_sync")
  assert.equal(store.box.state, "confirmed")
  assert.equal(store.box.code, 1)
})

test("si Supabase falla después del envío no se habilita otra alta", async () => {
  const assessment = martaAssessment()
  const store = attemptStore()
  store.box.failFinish = 1
  let registers = 0
  const deps = {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: store,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/get-clients") return jsonResponse({ code: 1, clients: [hidalgoRow()] })
      registers += 1
      return jsonResponse({ code: 1 })
    },
  }
  const first = await signUpLatamTvClient(assessment.body, deps)
  const second = await signUpLatamTvClient(assessment.body, deps)
  assert.equal(registers, 1)
  assert.equal(first.outcome, "pending_sync")
  assert.equal(second.outcome, "pending_sync")
  assert.equal(store.box.state, "register_sent")
})

test("los códigos 4, 5, 6 y 13 no liberan la reserva aunque el padrón no tenga al cliente", async () => {
  const assessment = martaAssessment()
  for (const code of [4, 5, 6, 13, 2, null]) {
    assert.equal(latamSignupRejectionReleasesAttempt(code), false)
  }
  for (const code of [4, 5, 6, 13]) {
    const store = attemptStore()
    let registers = 0
    const deps = {
      baseUrl: BASE,
      token: TOKEN,
      signupAttempt: store,
      fetchImpl: async (url) => {
        const path = new URL(url).pathname
        if (path === "/api/get-clients") return jsonResponse({ code: 1, clients: [hidalgoRow()] })
        registers += 1
        return jsonResponse({ code, id_iptv: 29 })
      },
    }
    const first = await signUpLatamTvClient(assessment.body, deps)
    const second = await signUpLatamTvClient(assessment.body, deps)
    assert.equal(registers, 1, `code ${code} volvió a crear`)
    assert.equal(first.outcome, "pending_sync")
    assert.equal(second.outcome, "pending_sync")
    assert.equal(store.box.state, "pending_sync")
    assert.match(first.message, /reserva sigue activa/)
    assert.equal(JSON.stringify(first).includes(assessment.body.password), false)
    assert.equal(JSON.stringify(first).includes("5788"), false)
  }
})

test("un usuario creado y ausente del padrón no habilita otra alta", async () => {
  const assessment = martaAssessment()
  const store = attemptStore()
  let registers = 0
  const deps = {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: store,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/get-clients") return jsonResponse({ code: 1, clients: [hidalgoRow()] })
      registers += 1
      return jsonResponse({
        code: 4,
        identificador: "4412",
        id_iptv: 29,
        dni: "30123456",
        usuario: "marta@example.com",
        status: 1,
      })
    },
  }
  const first = await signUpLatamTvClient(assessment.body, deps)
  const second = await signUpLatamTvClient(assessment.body, deps)
  assert.equal(registers, 1)
  assert.equal(first.outcome, "pending_sync")
  assert.equal(second.outcome, "pending_sync")
  assert.equal(store.box.state, "pending_sync")
  assert.equal(JSON.stringify(first).includes(assessment.body.password), false)
  assert.equal(JSON.stringify(first).includes("4412"), false)
})

test("un cliente ya existente no reserva ni llama a register-client", async () => {
  const assessment = martaAssessment()
  const store = attemptStore()
  let registers = 0
  const deps = {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: store,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/register-client") registers += 1
      return jsonResponse({
        code: 1,
        clients: [hidalgoRow(), martaRow({ identificador: "4412" })],
      })
    },
  }
  const result = await signUpLatamTvClient(assessment.body, deps)
  const again = await signUpLatamTvClient(assessment.body, deps)
  assert.equal(registers, 0)
  assert.equal(result.outcome, "already_exists")
  assert.equal(again.outcome, "already_exists")
  if (result.outcome === "already_exists") {
    assert.equal(result.identifier, "4412")
    assert.notEqual(result.identifier, "5788")
  }
  assert.equal(store.box.state, null)
  assert.equal(store.box.finishCalls, 0)
  assert.equal(JSON.stringify(result).includes(assessment.body.password), false)
})

test("una reconsulta sin reserva no finaliza ni crea otro usuario", async () => {
  const assessment = martaAssessment()
  const store = attemptStore()
  let registers = 0
  const deps = {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: store,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/register-client") registers += 1
      return jsonResponse({
        code: 1,
        clients: [hidalgoRow(), martaRow({ identificador: "4412" })],
      })
    },
  }
  const result = await refreshLatamSignupIdentity(assessment.body, deps)
  assert.equal(registers, 0)
  assert.equal(result.outcome, "already_exists")
  if (result.outcome === "already_exists") assert.equal(result.identifier, "4412")
  assert.equal(store.box.state, null)
  assert.equal(store.box.finishCalls, 0)
})

test("la sincronización posterior confirma la reserva sin otro alta", async () => {
  const assessment = martaAssessment()
  const store = attemptStore()
  let registers = 0
  let syncing = false
  const deps = {
    baseUrl: BASE,
    token: TOKEN,
    signupAttempt: store,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname
      if (path === "/api/get-clients") {
        const clients = syncing
          ? [hidalgoRow(), martaRow({ identificador: "4412" })]
          : [hidalgoRow()]
        return jsonResponse({ code: 1, clients })
      }
      registers += 1
      return jsonResponse({ code: 1, id_iptv: 29 })
    },
  }
  const created = await signUpLatamTvClient(assessment.body, deps)
  const denied = await signUpLatamTvClient(assessment.body, deps)
  syncing = true
  const synced = await refreshLatamSignupIdentity(assessment.body, deps)
  assert.equal(registers, 1)
  assert.equal(created.outcome, "pending_sync")
  assert.equal(denied.outcome, "pending_sync")
  assert.equal(synced.outcome, "already_exists")
  if (synced.outcome === "already_exists") {
    assert.equal(synced.identifier, "4412")
    assert.notEqual(synced.identifier, "5788")
  }
  assert.equal(store.box.state, "confirmed")
  assert.equal(store.box.code, 1)
})
