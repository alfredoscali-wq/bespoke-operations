/**
 * Plan de sincronización LATAM. No llama a la API real.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  confirmLatamSyncLink,
  planLatamSyncBatch,
  summarizeLatamSyncResults,
} from "../lib/integrations/latam-tv/sync-batch.ts"

const root = resolve(import.meta.dirname, "..")

function candidate(overrides = {}) {
  return {
    iptvId: "40",
    crmId: "3959",
    match: "dni_email",
    latamNationalId: "30111222",
    latamEmail: "cliente@example.com",
    bespokeNationalId: "30111222",
    bespokeEmail: "cliente@example.com",
    ...overrides,
  }
}

function live(overrides = {}) {
  return {
    iptvId: "40",
    crmId: null,
    nationalId: "30111222",
    email: "cliente@example.com",
    status: "enabled",
    planName: "Plan Basico",
    ...overrides,
  }
}

test("Toranzo ya vinculado no queda listo para escribir", () => {
  const [row] = planLatamSyncBatch(
    [
      candidate({
        iptvId: "29",
        crmId: "00006798",
        latamNationalId: "35.226.272",
        latamEmail: "GGerardoToranzo@hotmail.com.ar",
        bespokeNationalId: "35226272",
        bespokeEmail: "ggerardotoranzo@hotmail.com.ar",
      }),
    ],
    [
      live({
        iptvId: "29",
        crmId: "6798",
        nationalId: "35226272",
        email: "ggerardotoranzo@hotmail.com.ar",
        planName: "Plan Basico",
      }),
    ]
  )
  assert.equal(row.status, "already_synced")
  assert.equal(row.crmBefore, "6798")
  assert.equal(row.planName, "Plan Basico")
})

test("sin id_crm y con la misma identidad queda listo", () => {
  const [row] = planLatamSyncBatch([candidate()], [live()])
  assert.equal(row.status, "ready")
  assert.equal(row.crmBefore, null)
})

test("otro id_crm en el mismo id_iptv es conflicto", () => {
  const [row] = planLatamSyncBatch([candidate()], [live({ crmId: "111" })])
  assert.equal(row.status, "conflict")
})

test("el mismo N° Cliente en otro id_iptv es conflicto", () => {
  const [row] = planLatamSyncBatch(
    [candidate()],
    [live(), live({ iptvId: "91", crmId: "3959", nationalId: "20999888", email: "otro@example.com" })]
  )
  assert.equal(row.status, "conflict")
})

test("un id_iptv ausente no se escribe", () => {
  const [row] = planLatamSyncBatch([candidate({ iptvId: "404" })], [live()])
  assert.equal(row.status, "not_found")
})

test("un DNI distinto no se fuerza por ningún otro dato", () => {
  const [row] = planLatamSyncBatch(
    [candidate({ bespokeNationalId: "99999999" })],
    [live()]
  )
  assert.equal(row.status, "conflict")
})

test("coincidencia solo por DNI permite email Bespoke vacío", () => {
  const [row] = planLatamSyncBatch(
    [candidate({ match: "dni", bespokeEmail: null })],
    [live()]
  )
  assert.equal(row.status, "ready")
})

test("la coincidencia por DNI único no exige el mismo email", () => {
  const [row] = planLatamSyncBatch(
    [candidate({ match: "dni", bespokeEmail: "otro@example.com" })],
    [live()]
  )
  assert.equal(row.status, "ready")
})

test("la coincidencia por email único no exige el mismo DNI", () => {
  const [row] = planLatamSyncBatch(
    [candidate({ match: "email", bespokeNationalId: "11111111" })],
    [live()]
  )
  assert.equal(row.status, "ready")
})

test("un N° Cliente repetido no se asigna a dos id_iptv", () => {
  const rows = planLatamSyncBatch(
    [candidate({ iptvId: "13", crmId: "13" })],
    [live({ iptvId: "13" })]
  )
  assert.equal(rows[0].status, "conflict")
  const duplicated = planLatamSyncBatch(
    [
      candidate({ iptvId: "10", crmId: "1405" }),
      candidate({
        iptvId: "11",
        crmId: "1405",
        latamNationalId: "20111000",
        latamEmail: "segundo@example.com",
        bespokeNationalId: "20111000",
        bespokeEmail: "segundo@example.com",
      }),
    ],
    [
      live({ iptvId: "10" }),
      live({
        iptvId: "11",
        nationalId: "20111000",
        email: "segundo@example.com",
      }),
    ]
  )
  assert.deepEqual(
    duplicated.map((row) => row.status),
    ["conflict", "conflict"]
  )
})

test("si uno de los repetidos ya está vinculado, no se reescribe ni se copia al otro", () => {
  const rows = planLatamSyncBatch(
    [
      candidate({ iptvId: "10", crmId: "1405" }),
      candidate({
        iptvId: "11",
        crmId: "1405",
        latamNationalId: "20111000",
        latamEmail: "segundo@example.com",
        bespokeNationalId: "20111000",
        bespokeEmail: "segundo@example.com",
      }),
    ],
    [
      live({ iptvId: "10", crmId: "1405" }),
      live({ iptvId: "11", nationalId: "20111000", email: "segundo@example.com" }),
    ]
  )
  assert.deepEqual(
    rows.map((row) => row.status),
    ["already_synced", "conflict"]
  )
})

test("la reconsulta confirma solo el mismo id_iptv y el mismo id_crm", () => {
  assert.equal(
    confirmLatamSyncLink({
      iptvId: "29",
      crmId: "6798",
      probeIptvId: "29",
      probeCrmId: "00006798",
    }),
    true
  )
  assert.equal(
    confirmLatamSyncLink({
      iptvId: "29",
      crmId: "6798",
      probeIptvId: "30",
      probeCrmId: "6798",
    }),
    false
  )
  assert.equal(
    confirmLatamSyncLink({
      iptvId: "29",
      crmId: "6798",
      probeIptvId: "29",
      probeCrmId: null,
    }),
    false
  )
})

test("el resumen separa sincronizados de rechazos y no llama a la UI", () => {
  assert.deepEqual(
    summarizeLatamSyncResults([
      "already_synced",
      "synced",
      "synced",
      "not_found",
      "conflict",
      "rejected",
      "error",
      "verification_failed",
    ]),
    {
      total: 8,
      already_synced: 1,
      synced: 2,
      not_found: 1,
      conflict: 1,
      rejected: 1,
      error: 1,
      verification_failed: 1,
    }
  )
  const script = readFileSync(resolve(root, "scripts/latam-tv-sync-coincidencias.mjs"), "utf8")
  const ui = readFileSync(resolve(root, "components/subscriptions/subscriptions-module.tsx"), "utf8")
  assert.match(script, /--write/)
  assert.match(script, /syncLatamTvClient/)
  assert.match(script, /Coincidencias/)
  assert.doesNotMatch(script, /sheet_to_json\(wb\.Sheets\.Revisar/)
  assert.doesNotMatch(script, /\.from\("customers"\)/)
  assert.doesNotMatch(script, /\.update\(|\.insert\(|\.delete\(/)
  assert.doesNotMatch(script, /modify-client|disable-client|enable-client|register-client|modify-password|delete-client/)
  assert.doesNotMatch(ui, /sync-coincidencias|syncLatamTvClient/)
})
