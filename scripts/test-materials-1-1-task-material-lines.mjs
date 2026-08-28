import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  buildInsufficientStockWarning,
  unitsMatchCatalog,
  validateTaskMaterialLineQuantity,
} from "../lib/materials/task-material-lines.validation.ts"
import {
  buildPlanningMaterialsReport,
  formatStructuredLineForPrint,
  mapTaskMaterialLineToStructuredPrintLine,
} from "../lib/planificacion/planning-print-materials.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const migrationSql = read(
  "supabase/migrations/20261149000107_materials_1_1_task_material_lines.sql"
)

function makeTask(overrides = {}) {
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
    taskMetadata: {},
    ...overrides,
  }
}

const sampleLine = {
  id: "line-1",
  companyId: "c1",
  taskId: "t1",
  materialId: "m1",
  warehouseId: "w1",
  quantityPlanned: 500,
  unit: "m",
  notes: null,
  status: "planned",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  materialCode: "FO-12",
  materialName: "Fibra Óptica 12 Pelos",
  warehouseName: "Central",
  netAvailable: 2500,
}

test("1. Migración task_material_lines sin tocar stock", () => {
  assert.match(migrationSql, /CREATE TABLE public\.task_material_lines/)
  assert.match(migrationSql, /quantity_planned numeric/)
  assert.match(migrationSql, /task_material_line_status/)
  assert.match(migrationSql, /ENABLE ROW LEVEL SECURITY/)
  assert.doesNotMatch(migrationSql, /material_stock_levels/)
  assert.doesNotMatch(migrationSql, /quantity_reserved/)
  assert.doesNotMatch(migrationSql, /material_movements/)
})

test("2. Cantidad <= 0 rechazada", () => {
  const result = validateTaskMaterialLineQuantity("m", 0)
  assert.equal(result.ok, false)
})

test("3. Piezas con decimal rechazadas", () => {
  const result = validateTaskMaterialLineQuantity("un", 2.5)
  assert.equal(result.ok, false)
})

test("4. Metros con decimal permitidos", () => {
  const result = validateTaskMaterialLineQuantity("m", 2.5)
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.quantity, 2.5)
})

test("5. Advertencia stock insuficiente", () => {
  const warning = buildInsufficientStockWarning({
    quantityPlanned: 500,
    netAvailable: 200,
    unit: "m",
  })
  assert.match(warning ?? "", /Stock insuficiente/)
  assert.match(warning ?? "", /1\.500/)
  assert.match(warning ?? "", /2\.000/)
})

test("6. Unidad fija del catálogo", () => {
  assert.equal(unitsMatchCatalog("m", "m"), true)
  assert.equal(unitsMatchCatalog("m", "un"), false)
})

test("7. OT solo texto libre sigue en impresión", () => {
  const result = buildPlanningMaterialsReport({
    tasks: [
      makeTask({
        taskMetadata: { materialsNeeded: "Cable UTP 30m" },
      }),
    ],
    crews: [{ id: "crew-a", name: "Cuadrilla Norte" }],
    planningDate: "2026-07-13",
    crewId: "crew-a",
    linesByTaskId: {},
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.report.rows.length, 1)
    assert.equal(result.report.rows[0]?.materialsNeeded, "Cable UTP 30m")
    assert.equal(result.report.rows[0]?.structuredLines.length, 0)
  }
})

test("8. OT solo líneas estructuradas aparece en impresión", () => {
  const result = buildPlanningMaterialsReport({
    tasks: [makeTask({ id: "t1" })],
    crews: [{ id: "crew-a", name: "Cuadrilla Norte" }],
    planningDate: "2026-07-13",
    crewId: "crew-a",
    linesByTaskId: { t1: [sampleLine] },
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.report.rows.length, 1)
    assert.equal(result.report.rows[0]?.structuredLines.length, 1)
    assert.equal(result.report.rows[0]?.materialsNeeded, "")
  }
})

test("9. OT con ambos aparece en impresión", () => {
  const result = buildPlanningMaterialsReport({
    tasks: [
      makeTask({
        id: "t1",
        taskMetadata: { materialsNeeded: "Tornillos varios" },
      }),
    ],
    crews: [{ id: "crew-a", name: "Cuadrilla Norte" }],
    planningDate: "2026-07-13",
    crewId: "crew-a",
    linesByTaskId: { t1: [sampleLine] },
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    const row = result.report.rows[0]
    assert.equal(row?.structuredLines.length, 1)
    assert.equal(row?.materialsNeeded, "Tornillos varios")
  }
})

test("10. Formato línea estructurada para impresión", () => {
  const structured = mapTaskMaterialLineToStructuredPrintLine(sampleLine)
  const formatted = formatStructuredLineForPrint(structured)
  assert.match(formatted, /FO-12/)
  assert.match(formatted, /500/)
  assert.match(formatted, /Central/)
})

test("11. Endpoints y editor presentes", () => {
  assert.match(
    read("app/api/tasks/[taskId]/material-lines/route.ts"),
    /fetchTaskMaterialLines/
  )
  assert.match(
    read("components/materiales/task-material-lines-editor.tsx"),
    /MaterialCatalogPicker/
  )
  assert.match(
    read("components/planificacion/planning-task-adjust-sheet.tsx"),
    /TaskMaterialLinesEditor/
  )
})

test("12. materialsNeeded se mantiene en planning edit", () => {
  const planningEdit = read("lib/planificacion/planning-edit.ts")
  assert.match(planningEdit, /mergeMaterialsNeededIntoMetadata/)
  assert.match(planningEdit, /materialsNeeded/)
})

test("13. Auditoría de líneas definida", () => {
  const audit = read("lib/audit/task-material-lines-audit.ts")
  assert.match(audit, /TASK_MATERIAL_LINE_ADD/)
  assert.match(audit, /TASK_MATERIAL_LINE_UPDATE/)
  assert.match(audit, /TASK_MATERIAL_LINE_DELETE/)
})

test("14. Queries no modifican stock levels", () => {
  const queries = read("lib/supabase/task-material-lines.queries.ts")
  assert.doesNotMatch(queries, /record_material_stock/)
  assert.doesNotMatch(queries, /\.update\(.*material_stock_levels/)
  assert.doesNotMatch(queries, /quantity_reserved\s*=/)
})

test("15. RLS multi-tenant en migración", () => {
  assert.match(migrationSql, /company_id = public\.auth_user_company_id\(\)/)
  assert.match(migrationSql, /auth_can_read_task_material_lines/)
  assert.match(migrationSql, /auth_can_access_task_material_lines/)
})

test("16. Varias líneas por OT en reporte", () => {
  const result = buildPlanningMaterialsReport({
    tasks: [makeTask({ id: "t1" })],
    crews: [{ id: "crew-a", name: "Cuadrilla Norte" }],
    planningDate: "2026-07-13",
    crewId: "crew-a",
    linesByTaskId: {
      t1: [
        sampleLine,
        {
          ...sampleLine,
          id: "line-2",
          materialCode: "CAM-01",
          materialName: "Cámara IP",
          quantityPlanned: 2,
          unit: "un",
        },
      ],
    },
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.report.rows[0]?.structuredLines.length, 2)
  }
})
