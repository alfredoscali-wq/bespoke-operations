/**
 * RC 3.2.6 — consultation → Nueva OT create flow helpers.
 * Run: npx tsx --test scripts/test-customer-atenciones-rc-3-2-6-ot-create.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  buildConsultationOtCreateHref,
  buildConsultationOtCreatePrefill,
  buildCrewObservationsFromConsultation,
} from "../lib/customer-atenciones/consultation-ot-create.ts"
import { matchesOperationalCategory } from "../lib/customer-atenciones/shared-inbox.ts"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

test("build href opens Nueva OT with consultation context", () => {
  const href = buildConsultationOtCreateHref({
    atencionId: "11111111-1111-1111-1111-111111111111",
    customerId: "22222222-2222-2222-2222-222222222222",
  })
  assert.match(href, /^\/tareas\?/)
  assert.match(href, /nuevaOt=1/)
  assert.match(href, /atencionId=11111111-1111-1111-1111-111111111111/)
  assert.match(href, /customerId=22222222-2222-2222-2222-222222222222/)
})

test("crew observations include origin reference", () => {
  const prefill = buildConsultationOtCreatePrefill({
    atencionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    customerId: "22222222-2222-2222-2222-222222222222",
    motivoLabel: "Problema técnico",
    initialObservations: "Sin señal",
    technicalHistory: "Requiere visita",
  })
  const notes = buildCrewObservationsFromConsultation(prefill)
  assert.match(notes, /Consulta de origen:/)
  assert.match(notes, /Problema técnico/)
  assert.match(notes, /Sin señal/)
  assert.match(notes, /Requiere visita/)
})

test("OT por Generar KPI excludes linked consultations", () => {
  assert.equal(
    matchesOperationalCategory(
      {
        status: "para_resolver",
        nextStep: "generar_ot",
        followUpActions: [],
        linkedTaskId: null,
      },
      "generar_ot"
    ),
    true
  )
  assert.equal(
    matchesOperationalCategory(
      {
        status: "para_resolver",
        nextStep: "generar_ot",
        followUpActions: [],
        linkedTaskId: "task-1",
      },
      "generar_ot"
    ),
    false
  )
})

test("OtLinkBlock no longer asks for UUID", () => {
  const source = fs.readFileSync(
    path.join(root, "components/atencion-cliente/ot-link-block.tsx"),
    "utf8"
  )
  assert.match(source, /Crear Orden de Trabajo/)
  assert.doesNotMatch(source, /Vincular OT/)
  assert.doesNotMatch(source, /ot-task-id/)
  assert.doesNotMatch(source, /placeholder=.*orden de trabajo/i)
})

test("migration clears generar_ot on link", () => {
  const migration = fs.readFileSync(
    path.join(
      root,
      "supabase/migrations/20261021000100_customer_atenciones_ot_create_link_rc_3_2_6.sql"
    ),
    "utf8"
  )
  assert.match(migration, /WHEN v_atencion\.next_step = 'generar_ot' THEN NULL/)
  assert.match(migration, /WHERE action IS DISTINCT FROM 'generar_ot'/)
  assert.match(migration, /consulta_ot_vinculada/)
})
