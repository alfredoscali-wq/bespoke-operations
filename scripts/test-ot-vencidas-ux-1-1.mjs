/**
 * Sprint OT Vencidas UX 1.1 — KPI filter (no drawer), row actions, active KPI.
 */
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

test("drawer lateral OT Vencidas was removed", () => {
  assert.equal(
    existsSync(resolve(root, "components/tareas/tasks-vencidas-drawer.tsx")),
    false
  )
  const module = read("components/tareas/tasks-module.tsx")
  assert.doesNotMatch(module, /TasksVencidasDrawer/)
  assert.doesNotMatch(module, /vencidasDrawerOpen/)
})

test("OT Vencidas KPI toggles table filter like planning returned", () => {
  const module = read("components/tareas/tasks-module.tsx")
  assert.match(module, /vencidasFilterActive/)
  assert.match(module, /handleVencidasKpiToggle/)
  assert.match(module, /listVencidaTasks/)
  assert.match(module, /parseVencidasQuery/)
  assert.match(module, /onToggle=\{handleVencidasKpiToggle\}/)

  const kpi = read("components/tareas/tasks-vencidas-kpi.tsx")
  assert.match(kpi, /onToggle/)
  assert.doesNotMatch(kpi, /onOpen/)
})

test("row actions for vencida: ver detalle + reprogramar only", () => {
  const actions = read("components/tareas/task-admin-row-actions.tsx")
  assert.match(actions, /showVencidaReschedule/)
  assert.match(actions, /isRestrictedTray/)
  assert.match(actions, /TaskReprogramFromVencidaDialog/)
  assert.match(actions, /isVencidaStatus/)
})

test("FilterableKpiCard exposes visible active state", () => {
  const card = read("components/ui/filterable-kpi-card.tsx")
  assert.match(card, /ACTIVE_CLASS/)
  assert.match(card, /isActive/)
  assert.match(card, /aria-pressed=\{isActive\}/)
})

test("reprogram modal and historial event remain wired", () => {
  const dialog = read("components/tareas/task-reprogram-from-vencida-dialog.tsx")
  assert.match(dialog, /Motivo de reprogramación/)
  assert.match(dialog, /Nueva fecha/)
  assert.match(dialog, /Reprogramar OT/)
  assert.match(dialog, /rescheduleTaskFromOverdue/)

  const motivos = read("lib/tasks/operational-motivos.ts")
  assert.match(motivos, /ot_reprogramada_por_vencimiento/)
})
