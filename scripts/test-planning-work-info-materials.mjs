import assert from "node:assert/strict"
import test from "node:test"

import {
  buildPlanningEditFormFromTask,
  buildPlanningTaskUpdateBatch,
} from "../lib/planificacion/planning-edit.ts"
import {
  formatServiceTechnicalReasonLabel,
  mergeMaterialsNeededIntoMetadata,
  readMaterialsNeededFromTask,
  resolveServiceTechnicalWorkInfoFromTask,
} from "../lib/tasks/work-order.ts"

const serviceTask = {
  id: "task-1",
  code: "TSK-OT-1",
  title: "Service Técnico",
  description: "",
  type: "fiber",
  status: "asignada",
  priority: "media",
  supervisor: "Sup",
  crew: "Cuadrilla 1",
  crewId: "crew-1",
  startDate: "2026-07-10",
  dueDate: "2026-07-10",
  estimatedDuration: "45 min",
  progress: 0,
  checklist: [],
  serviceType: "service-tecnico",
  taskMetadata: {
    reason: "sin-conexion",
    detail:
      "Cliente informa que desde la tormenta perdió el servicio.\nReinició el router.",
    materialsNeeded: "Cable UTP 30 metros\n2 conectores RJ45",
    shift: "manana",
  },
}

test("Motivo de Service Técnico se muestra con etiqueta legible", () => {
  assert.equal(
    formatServiceTechnicalReasonLabel("sin-conexion"),
    "Sin conexión"
  )

  const info = resolveServiceTechnicalWorkInfoFromTask(serviceTask)
  assert.ok(info)
  assert.equal(info.reasonLabel, "Sin conexión")
  assert.equal(
    info.detail,
    "Cliente informa que desde la tormenta perdió el servicio.\nReinició el router."
  )
})

test("Información del Trabajo no aplica a otras OT", () => {
  assert.equal(
    resolveServiceTechnicalWorkInfoFromTask({
      serviceType: "instalacion-nueva",
      taskMetadata: { reason: "sin-conexion", detail: "x" },
    }),
    null
  )
})

test("Materiales Necesarios se leen y preservan saltos de línea", () => {
  const materials = readMaterialsNeededFromTask(serviceTask)
  assert.equal(materials, "Cable UTP 30 metros\n2 conectores RJ45")

  const merged = mergeMaterialsNeededIntoMetadata(
    { shift: "tarde", reason: "lentitud" },
    "Fuente 24V\n\nEscalera"
  )
  assert.equal(merged.materialsNeeded, "Fuente 24V\n\nEscalera")
  assert.equal(merged.shift, "tarde")
  assert.equal(merged.reason, "lentitud")
})

test("Vaciar Materiales Necesarios elimina la clave (compatibilidad / delete)", () => {
  const cleared = mergeMaterialsNeededIntoMetadata(
    { materialsNeeded: "Cable", shift: "manana" },
    ""
  )
  assert.equal(cleared.materialsNeeded, undefined)
  assert.equal(cleared.shift, "manana")
})

test("Planificación carga y persiste materiales en el batch de update", () => {
  const form = buildPlanningEditFormFromTask(
    /** @type {any} */ (serviceTask),
    [],
    [{ id: "crew-1", name: "Cuadrilla 1" }]
  )

  assert.equal(
    form.materialsNeeded,
    "Cable UTP 30 metros\n2 conectores RJ45"
  )

  const batch = buildPlanningTaskUpdateBatch({
    task: /** @type {any} */ (serviceTask),
    form: {
      ...form,
      materialsNeeded: "Roseta.\nPatch cord.",
    },
    crew: { id: "crew-1", name: "Cuadrilla 1", supervisor: "Sup" },
    allTasks: [],
    crews: [{ id: "crew-1", name: "Cuadrilla 1" }],
  })

  assert.equal(
    batch.primaryPayload.taskMetadata?.materialsNeeded,
    "Roseta.\nPatch cord."
  )
  assert.equal(batch.primaryPayload.taskMetadata?.reason, "sin-conexion")
  assert.equal(batch.primaryPayload.taskMetadata?.shift, "manana")
})
