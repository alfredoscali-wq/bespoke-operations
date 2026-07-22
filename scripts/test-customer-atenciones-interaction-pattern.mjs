/**
 * Interaction pattern — domain helpers + source contracts.
 * Run: npx tsx --test scripts/test-customer-atenciones-interaction-pattern.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  resolveNextActionAt,
  validateRegisterInteractionInput,
} from "../lib/customer-atenciones/consultation-interaction.ts"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const migration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20261025000100_customer_atenciones_interaction_pattern.sql"
  ),
  "utf8"
)

test("register interaction validation requires detail", () => {
  const bad = validateRegisterInteractionInput({
    kind: "contact",
    result: "no_atiende",
    detail: "  ",
  })
  assert.ok("error" in bad)

  const ok = validateRegisterInteractionInput({
    kind: "contact",
    result: "llamar_mas_tarde",
    detail: "Pidió que lo llamemos mañana a la mañana",
    nextActionAt: resolveNextActionAt("tomorrow"),
  })
  assert.ok(!("error" in ok))
  assert.equal(ok.kind, "contact")
  assert.ok(ok.nextActionAt)
})

test("shared contact catalog is circuit-agnostic", async () => {
  const {
    CONSULTATION_CONTACT_RESULTS,
    CONSULTATION_CONTACT_RESULT_LABELS,
    formatInteractionResultLabel,
    isConsultationContactResult,
  } = await import("../lib/customer-atenciones/consultation-interaction.ts")

  assert.ok(CONSULTATION_CONTACT_RESULTS.includes("no_atiende"))
  assert.ok(CONSULTATION_CONTACT_RESULTS.includes("otro"))
  assert.equal(
    CONSULTATION_CONTACT_RESULT_LABELS.linea_ocupada,
    "Línea ocupada"
  )
  assert.equal(isConsultationContactResult("promesa_pago"), false)
  assert.equal(
    formatInteractionResultLabel("contact", "promesa_pago"),
    "Promesa de pago"
  )
})

test("migration never mutates tray on interaction RPC", () => {
  assert.match(migration, /register_customer_atencion_interaction/)
  assert.match(migration, /interaccion_registrada/)
  assert.match(migration, /next_action_at/)
  assert.match(migration, /interaction_kind/)
})

test("moroso tracking writes process interaction without tray change", () => {
  assert.match(migration, /'process'/)
  assert.match(
    migration,
    /MOROSO_TRACKING_NOT_APPLICABLE: El seguimiento de morosos solo aplica a consultas de Administración - Morosos/
  )
})

const sessionEndMigration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20261026000100_customer_atenciones_interaction_ends_management.sql"
  ),
  "utf8"
)

test("contact and note release management via shared helper; process does not", () => {
  assert.match(
    sessionEndMigration,
    /apply_customer_atencion_management_session_end/
  )
  assert.match(sessionEndMigration, /v_kind IN \('contact', 'note'\)/)
  assert.match(sessionEndMigration, /management_released/)
  assert.match(
    sessionEndMigration,
    /cancel_customer_atencion_management/
  )
})
