/**
 * Sprint Tesorería 2.0 — Pendientes de Rendición (OT → caja).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  buildOtRenditionKpi,
  formatOtRenditionKpiCount,
  shouldCreateOtCashRendition,
} from "../lib/tesoreria/ot-renditions.ts"
import { TREASURY_OT_RENDITION_STATUSES } from "../lib/tesoreria/ot-rendition-status.ts"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

test("shouldCreateOtCashRendition only for finalizada with amount > 0", () => {
  assert.equal(
    shouldCreateOtCashRendition({
      status: "finalizada",
      amountToCollect: 50000,
    }),
    true
  )
  assert.equal(
    shouldCreateOtCashRendition({
      status: "finalizada",
      amountToCollect: 0,
    }),
    false
  )
  assert.equal(
    shouldCreateOtCashRendition({
      status: "en-curso",
      amountToCollect: 50000,
    }),
    false
  )
})

test("KPI counts pending renditions only (not rendida)", () => {
  const kpi = buildOtRenditionKpi([
    { status: TREASURY_OT_RENDITION_STATUSES.PENDING, amount: 100 },
    { status: TREASURY_OT_RENDITION_STATUSES.PENDING, amount: 50 },
    { status: TREASURY_OT_RENDITION_STATUSES.RENDERED, amount: 999 },
  ])
  assert.equal(kpi.count, 2)
  assert.equal(kpi.totalAmount, 150)
  assert.equal(formatOtRenditionKpiCount(12), "12 OT")
})

test("approveTask wires auto pending rendition without auto income", () => {
  const workflow = read(
    "components/tareas/tasks-provider/hooks/use-tasks-workflow.ts"
  )
  assert.match(workflow, /shouldCreateOtCashRendition/)
  assert.match(workflow, /ensureOtCashRenditionForTask/)
  assert.doesNotMatch(
    workflow,
    /createTreasuryMovement[\s\S]*approveTask|approveTask[\s\S]*createTreasuryMovement/
  )
})

test("confirm flow creates Cobranza OT income + ot_rendida event", () => {
  const queries = read("lib/supabase/treasury-ot-renditions.queries.ts")
  assert.match(queries, /OT_RENDITION_INCOME_CATEGORY/)
  assert.match(queries, /TREASURY_ORIGINS\.TASK/)
  assert.match(queries, /TREASURY_MOVEMENT_TYPES\.INCOME/)
  assert.match(queries, /TREASURY_OT_RENDITION_STATUSES\.RENDERED/)

  const motivos = read("lib/tasks/operational-motivos.ts")
  assert.match(motivos, /ot_rendida/)
  assert.match(motivos, /persona_entrega/)
  assert.match(motivos, /usuario_registro/)

  const provider = read("components/tesoreria/treasury-provider.tsx")
  assert.match(provider, /confirmOtRendition/)
  assert.match(provider, /buildOtRendidaOperationalEvent/)
})

test("UI: clickable KPI + list + confirm modal without delete", () => {
  const module = read("components/tesoreria/treasury-module.tsx")
  assert.match(module, /pendingRenditionFilterActive/)
  assert.match(module, /TreasuryPendingRenditionsList/)

  const kpi = read("components/tesoreria/treasury-pending-rendition-kpi.tsx")
  assert.match(kpi, /Pendientes de Rendición/)
  assert.match(kpi, /onToggle/)
  assert.match(kpi, /tone="amber"/)

  const list = read("components/tesoreria/treasury-pending-renditions-list.tsx")
  assert.match(list, /Registrar Rendición/)
  assert.match(list, /Ver OT/)
  assert.doesNotMatch(list, />\s*Eliminar\s*</)

  const dialog = read("components/tesoreria/treasury-confirm-rendition-dialog.tsx")
  assert.match(dialog, /Monto recibido/)
  assert.match(dialog, /Persona que entrega dinero/)
  assert.match(dialog, /Confirmar Rendición/)

  const migration = read(
    "supabase/migrations/20261122000100_tesoreria_2_0_ot_renditions.sql"
  )
  assert.match(migration, /pendiente_rendicion/)
  assert.match(migration, /ensure_treasury_ot_rendition_for_task/)
})
