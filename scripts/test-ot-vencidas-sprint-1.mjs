/**
 * Sprint OT Vencidas 1.0 — KPI count helpers, reprogram flow, historial event.
 * UX 1.1 removed the drawer; filter pattern is covered in test-ot-vencidas-ux-1-1.mjs.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

test("vencida helpers expose KPI count/list by status=vencida", () => {
  const source = read("lib/tasks/vencida-status.ts")
  assert.match(source, /export function countVencidaTasks/)
  assert.match(source, /export function listVencidaTasks/)
  assert.match(source, /isVencidaStatus\(task\.status\)/)
})

test("workflow reprogram from overdue targets programada", () => {
  const source = read("lib/tasks/task-status-workflow.ts")
  assert.match(
    source,
    /"reschedule-from-overdue":\s*\{\s*from:\s*\["vencida"\],\s*to:\s*"programada"\s*\}/
  )
})

test("operational event type ot_reprogramada_por_vencimiento is registered", () => {
  const types = read("lib/types/operational-control.ts")
  assert.match(types, /ot_reprogramada_por_vencimiento/)

  const motivos = read("lib/tasks/operational-motivos.ts")
  assert.match(motivos, /buildOverdueRescheduleOperationalEvent/)
  assert.match(motivos, /eventType:\s*"ot_reprogramada_por_vencimiento"/)
  assert.match(motivos, /fecha_original/)
  assert.match(motivos, /nueva_fecha/)
  assert.match(motivos, /motivo/)
  assert.match(motivos, /usuario/)
  assert.match(motivos, /timestamp/)
})

test("incidents hook records overdue historial and uses programada target", () => {
  const source = read(
    "components/tareas/tasks-provider/hooks/use-tasks-incidents.ts"
  )
  assert.match(source, /buildOverdueRescheduleOperationalEvent/)
  assert.match(source, /reschedule-from-overdue/)
  assert.match(source, /getInitialTaskStatus/)
})

test("UI: KPI filter + reprogram dialog wired on /tareas (no drawer)", () => {
  const module = read("components/tareas/tasks-module.tsx")
  assert.match(module, /TasksVencidasKpi/)
  assert.doesNotMatch(module, /TasksVencidasDrawer/)

  const kpi = read("components/tareas/tasks-vencidas-kpi.tsx")
  assert.match(kpi, /OT Vencidas/)
  assert.match(
    kpi,
    /OT que no pudieron ejecutarse y requieren reprogramación/
  )
  assert.match(kpi, /tone="red"/)
  assert.match(kpi, /onToggle/)

  const dialog = read("components/tareas/task-reprogram-from-vencida-dialog.tsx")
  assert.match(dialog, /Motivo de reprogramación/)
  assert.match(dialog, /Nueva fecha/)
  assert.match(dialog, /Reprogramar OT/)
  assert.match(dialog, /rescheduleTaskFromOverdue/)
})
