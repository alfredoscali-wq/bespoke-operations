/**
 * RC 3.2.7 — OT link closes consultation in Atención.
 * Run: npx tsx --test scripts/test-customer-atenciones-rc-3-2-7-ot-link-resolves.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  formatConsultationEstadoActualBadge,
  formatConsultationEstadoActualSummary,
} from "../lib/customer-atenciones/consultation-expediente.ts"
import { matchesOperationalCategory } from "../lib/customer-atenciones/shared-inbox.ts"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

test("Estado actual after OT link describes Atención closed", () => {
  const sentence = formatConsultationEstadoActualSummary({
    status: "resuelta",
    nextStep: null,
    linkedTaskId: "task-1",
  })
  assert.match(sentence, /Consulta resuelta/)
  assert.match(sentence, /Orden de Trabajo/)
  assert.doesNotMatch(sentence, /para resolver/i)
  assert.equal(
    formatConsultationEstadoActualBadge({
      status: "resuelta",
      linkedTaskId: "task-1",
    }),
    "Resuelta"
  )
})

test("KPI OT por generar excludes linked and does not keep linked in para_resolver category", () => {
  assert.equal(
    matchesOperationalCategory(
      {
        status: "resuelta",
        nextStep: null,
        followUpActions: [],
        linkedTaskId: "task-1",
      },
      "generar_ot"
    ),
    false
  )
})

test("migration closes consultation on link_customer_atencion_to_task", () => {
  const sql = fs.readFileSync(
    path.join(
      root,
      "supabase/migrations/20261023000100_customer_atenciones_ot_link_resolves_rc_3_2_7.sql"
    ),
    "utf8"
  )
  assert.match(sql, /status = 'resuelta'/)
  assert.match(sql, /resolved_at/)
  assert.match(sql, /resolved_by_employee_id/)
  assert.match(sql, /v_previous_status,\s*'resuelta'/s)
  assert.doesNotMatch(sql, /action_type,\s*'consulta_resuelta'/)
})

test("OtLinkBlock shows linked card title when OT exists", () => {
  const source = fs.readFileSync(
    path.join(root, "components/atencion-cliente/ot-link-block.tsx"),
    "utf8"
  )
  assert.match(source, /Orden de Trabajo vinculada/)
  assert.match(source, /Abrir Orden de Trabajo/)
  assert.match(source, /Pendiente de generar OT/)
})
