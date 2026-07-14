import assert from "node:assert/strict"
import test from "node:test"

import {
  buildPlanningMaterialsReport,
  buildPlanningMaterialsReportHtml,
} from "../lib/planificacion/planning-print-materials.ts"

function makeTask(overrides) {
  return {
    id: "t1",
    code: "TSK-OT-1",
    title: "Service",
    description: "",
    type: "fiber",
    status: "programada",
    priority: "media",
    supervisor: "Sup",
    crew: "Cuadrilla Norte",
    crewId: "crew-a",
    startDate: "2026-07-13",
    dueDate: "2026-07-13",
    estimatedDuration: "45 min",
    progress: 0,
    checklist: [],
    customerName: "Juan Pérez",
    serviceAddress: "Calle 123",
    locality: "Centro",
    workOrderNumber: "OT-100",
    executionOrder: 2,
    dispatchOrder: null,
    taskMetadata: {
      materialsNeeded: "Cable UTP 30 metros\n2 conectores RJ45",
    },
    ...overrides,
  }
}

const crews = [
  { id: "crew-a", name: "Cuadrilla Norte" },
  { id: "crew-b", name: "Cuadrilla Sur" },
]

test("exige cuadrilla", () => {
  const result = buildPlanningMaterialsReport({
    tasks: [makeTask()],
    crews,
    planningDate: "2026-07-13",
    crewId: "",
  })
  assert.equal(result.ok, false)
})

test("ordena por orden de ejecución y conserva materiales exactos", () => {
  const tasks = [
    makeTask({
      id: "t2",
      code: "TSK-OT-2",
      workOrderNumber: "OT-200",
      executionOrder: 1,
      customerName: "Ana",
      taskMetadata: { materialsNeeded: "Fuente 24V" },
    }),
    makeTask({
      id: "t1",
      executionOrder: 2,
      taskMetadata: {
        materialsNeeded: "Cable UTP 30 metros\n2 conectores RJ45",
      },
    }),
    makeTask({
      id: "t3",
      code: "TSK-OT-3",
      workOrderNumber: "OT-300",
      executionOrder: 3,
      taskMetadata: {},
    }),
  ]

  const result = buildPlanningMaterialsReport({
    tasks,
    crews,
    planningDate: "2026-07-13",
    crewId: "crew-a",
  })

  assert.equal(result.ok, true)
  if (!result.ok) return

  assert.equal(result.report.rows.length, 2)
  assert.equal(result.report.rows[0].executionOrder, "1")
  assert.equal(result.report.rows[0].workOrderNumber, "OT-200")
  assert.equal(result.report.rows[1].executionOrder, "2")
  assert.equal(
    result.report.rows[1].materialsNeeded,
    "Cable UTP 30 metros\n2 conectores RJ45"
  )
  assert.equal(result.report.crewName, "Cuadrilla Norte")
})

test("filtra por cuadrilla", () => {
  const result = buildPlanningMaterialsReport({
    tasks: [
      makeTask({ crewId: "crew-a", crew: "Cuadrilla Norte" }),
      makeTask({
        id: "t-b",
        crewId: "crew-b",
        crew: "Cuadrilla Sur",
        workOrderNumber: "OT-999",
        executionOrder: 1,
        taskMetadata: { materialsNeeded: "Escalera" },
      }),
    ],
    crews,
    planningDate: "2026-07-13",
    crewId: "crew-b",
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.report.rows.length, 1)
  assert.equal(result.report.rows[0].workOrderNumber, "OT-999")
})

test("HTML escapa contenido y preserva saltos en pre", () => {
  const result = buildPlanningMaterialsReport({
    tasks: [
      makeTask({
        taskMetadata: {
          materialsNeeded: "A <B>\nLinea 2",
        },
      }),
    ],
    crews,
    planningDate: "2026-07-13",
    crewId: "crew-a",
  })
  assert.equal(result.ok, true)
  if (!result.ok) return

  const html = buildPlanningMaterialsReportHtml(result.report)
  assert.match(html, /A &lt;B&gt;/)
  assert.match(html, /<pre class="materials-body">/)
  assert.match(html, /Cuadrilla Norte/)
})

test("sin materiales genera informe vacío con mensaje", () => {
  const result = buildPlanningMaterialsReport({
    tasks: [
      makeTask({
        taskMetadata: {},
      }),
    ],
    crews,
    planningDate: "2026-07-13",
    crewId: "crew-a",
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.report.rows.length, 0)

  const html = buildPlanningMaterialsReportHtml(result.report)
  assert.match(
    html,
    /No hay materiales registrados para esta cuadrilla\./
  )
  assert.match(html, /Informe de Materiales por Cuadrilla/)
  assert.match(html, /Cuadrilla Norte/)
})
