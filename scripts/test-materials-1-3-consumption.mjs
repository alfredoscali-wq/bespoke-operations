import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  computeQuantityReturned,
  taskHasActiveCatalogMaterialLines,
  taskRequiresMaterialConsumptionConfirmation,
  validateConsumedQuantity,
} from "../lib/materials/task-material-consumption.ts"
import { getTaskMaterialLineReservationDisplay } from "../lib/materials/reservation-status.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const migration13 = read(
  "supabase/migrations/20261149000109_materials_1_3_consumption.sql"
)
const migration12 = read(
  "supabase/migrations/20261149000108_materials_1_2_reservations.sql"
)
const consumptionQueries = read("lib/supabase/task-material-consumption.queries.ts")
const consumptionPanel = read("components/materiales/task-material-consumption-panel.tsx")
const taskMaterialsPanel = read("components/materiales/task-materials-panel.tsx")
const operarioFooter = read("components/operario/operario-task-closure-footer.tsx")
const workflowHook = read(
  "components/tareas/tasks-provider/hooks/use-tasks-workflow.ts"
)
const overviewTab = read("components/tareas/task-tabs/overview-tab.tsx")
const planningDetail = read(
  "components/planificacion/planning-pending-closure-detail-panel.tsx"
)
const auditTypes = read("lib/audit/types.ts")

// OT SIN MATERIALES

test("1. OT sin materiales de catálogo → finaliza normalmente (guard solo con reservas)", () => {
  assert.match(migration13, /task_has_reserved_catalog_material_lines\(NEW\.id\)/)
  assert.match(migration13, /NO_RESERVED_LINES/)
})

test("2. materialsNeeded no activa flujo inventario", () => {
  assert.match(migration13, /task_has_active_catalog_material_lines/)
  assert.doesNotMatch(taskMaterialsPanel, /materialsNeeded.*taskHasActiveCatalogMaterialLines/s)
  assert.match(taskMaterialsPanel, /readMaterialsNeededFromTask/)
})

test("3. OT sin catálogo → operario no muestra UI de consumo", () => {
  assert.match(operarioFooter, /hasReservedMaterials/)
  assert.match(operarioFooter, /if \(!hasReservedMaterials\)/)
  assert.match(consumptionPanel, /if \(!hasReservedLines \|\| mode === "done"\)/)
})

test("4. OT sin materiales → confirm RPC no-op sin reservas", () => {
  assert.match(migration13, /skipped', true/)
  assert.match(migration13, /reason', 'NO_RESERVED_LINES'/)
})

test("5. OT sin materiales → reserva no descuenta stock físico (1.2)", () => {
  assert.doesNotMatch(migration12, /quantity_available = quantity_available -/)
  assert.match(migration12, /quantity_reserved \+ p_delta/)
})

test("6. approveTask sin reservas no bloquea por materiales", () => {
  assert.match(workflowHook, /fetchReservedTaskMaterialLinesClient/)
  assert.match(workflowHook, /reservedLines\.length > 0/)
  assert.match(workflowHook, /catch \{/)
})

test("7. Usuario sin acceso → catch permite cierre (trigger SQL protege)", () => {
  assert.match(workflowHook, /Sin acceso al módulo o sin líneas reservadas/)
})

// OT CON MATERIALES

test("8. OT con línea reservada → panel consumo en pendiente de cierre", () => {
  assert.match(consumptionPanel, /Materiales utilizados/)
  assert.match(consumptionPanel, /¿Se utilizaron todos/)
  assert.match(overviewTab, /showConsumptionConfirmation=\{isPendingClosureStatus/)
})

test("9. Sí, todos → consume toda la reserva", () => {
  assert.match(migration13, /v_consumed := v_line\.quantity_planned/)
  assert.match(migration13, /v_returned := 0/)
  assert.match(consumptionPanel, /useAll: true/)
})

test("10. Consumo parcial descuenta solo consumido", () => {
  assert.match(migration13, /quantity_available = quantity_available - v_consumed/)
})

test("11. Diferencia libera devolución sin sumar stock físico", () => {
  assert.match(migration13, /v_returned := v_reserved - v_consumed/)
  assert.match(migration13, /quantity_reserved = quantity_reserved - v_reserved/)
  assert.doesNotMatch(migration13, /quantity_available = quantity_available \+ v_returned/)
})

test("12. Consumo mayor que reservado → rechaza", () => {
  const result = validateConsumedQuantity({
    unit: "m",
    quantityReserved: 1000,
    quantityConsumed: 1200,
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.message, /1\.000/)
    assert.match(result.message, /superar/)
  }
  assert.match(migration13, /materials_validate_consumed_quantity/)
})

test("13. Consumo negativo → rechaza", () => {
  const result = validateConsumedQuantity({
    unit: "m",
    quantityReserved: 1000,
    quantityConsumed: -1,
  })
  assert.equal(result.ok, false)
})

test("14. Piezas con decimales → rechaza", () => {
  const result = validateConsumedQuantity({
    unit: "pza",
    quantityReserved: 2,
    quantityConsumed: 1.5,
  })
  assert.equal(result.ok, false)
})

test("15. En curso no descuenta stock físico", () => {
  assert.doesNotMatch(migration12, /en-curso.*quantity_available -/s)
  assert.doesNotMatch(migration13, /en-curso.*quantity_available -/s)
})

test("16. Pendiente de cierre antes de confirmar no descuenta stock", () => {
  assert.match(migration13, /Los materiales solo pueden confirmarse con la OT pendiente de cierre/)
  assert.match(migration13, /quantity_available = quantity_available - v_consumed/)
  assert.doesNotMatch(migration13, /BEFORE UPDATE OF status ON public\.tasks[\s\S]*quantity_available - v_consumed/)
})

test("17. Confirmación actualiza stock físico y reserva", () => {
  assert.match(migration13, /quantity_available = quantity_available - v_consumed/)
  assert.match(migration13, /quantity_reserved = quantity_reserved - v_reserved/)
})

test("18. Movimiento consumption registrado", () => {
  assert.match(migration13, /'consumption'::public\.material_movement_type/)
  assert.match(auditTypes, /MATERIAL_CONSUMPTION_CREATED/)
})

test("19. Reserva queda en 0 después del cierre (línea consumed)", () => {
  assert.match(migration13, /status = 'consumed'::public\.task_material_line_status/)
  assert.deepEqual(getTaskMaterialLineReservationDisplay("consumed"), {
    label: "Consumido",
    tone: "success",
  })
})

test("20. Finalizar bloqueada con reservas pendientes", () => {
  assert.match(migration13, /MATERIAL_CONSUMPTION_REQUIRED/)
  assert.match(workflowHook, /MATERIAL_CONSUMPTION_REQUIRED_MESSAGE/)
})

test("21. Cancelación libera reserva (Materiales 1.2)", () => {
  assert.match(migration12, /NEW\.status = 'cancelada'/)
  assert.match(migration12, /release_all_task_material_reservations_internal/)
})

test("22. Eliminación libera reserva (Materiales 1.2)", () => {
  assert.match(migration12, /NEW\.deleted_at IS NOT NULL/)
})

test("23. Replanificación mantiene reserva (Materiales 1.2)", () => {
  assert.doesNotMatch(
    migration12,
    /programada.*release_all_task_material_reservations_internal/s
  )
})

test("24. Multi-depósito consume del depósito correcto", () => {
  assert.match(migration13, /lock_material_stock_level/)
  assert.match(migration13, /v_line\.warehouse_id/)
})

test("25. Fallo transaccional → función PL/pgSQL con locks FOR UPDATE", () => {
  assert.match(migration13, /FOR UPDATE/)
  assert.match(migration13, /lock_material_stock_level/)
})

// OT CON AMBOS

test("26. Catálogo + materialsNeeded: catálogo consume, texto libre informativo", () => {
  assert.match(taskMaterialsPanel, /Materiales adicionales/)
  assert.match(taskMaterialsPanel, /materialsNeeded/)
  assert.match(taskMaterialsPanel, /Materiales del catálogo/)
})

test("27. taskHasActiveCatalogMaterialLines ignora consumed/cancelled", () => {
  assert.equal(
    taskHasActiveCatalogMaterialLines([{ status: "consumed" }]),
    false
  )
  assert.equal(
    taskHasActiveCatalogMaterialLines([{ status: "planned" }]),
    true
  )
})

test("28. Sin líneas reservadas activas → no requiere confirmación", () => {
  assert.equal(
    taskRequiresMaterialConsumptionConfirmation([{ status: "consumed" }]),
    false
  )
  assert.equal(
    taskRequiresMaterialConsumptionConfirmation([{ status: "reserved" }]),
    true
  )
})

test("29. Devolución calculada = reservado - utilizado", () => {
  assert.equal(computeQuantityReturned(1000, 850), 150)
})

test("30. Detalle OT muestra planificado/reservado/consumido/devuelto", () => {
  assert.match(taskMaterialsPanel, /Planificado/)
  assert.match(taskMaterialsPanel, /Consumido/)
  assert.match(taskMaterialsPanel, /Devuelto/)
})

test("31. Panel vacío si no hay líneas de catálogo ni texto libre", () => {
  assert.match(taskMaterialsPanel, /return null/)
})

test("32. Planning pending closure incluye confirmación de materiales", () => {
  assert.match(planningDetail, /TaskMaterialsPanel/)
  assert.match(planningDetail, /showConsumptionConfirmation/)
})

test("33. RPC confirm_task_material_consumption expuesta en queries", () => {
  assert.match(consumptionQueries, /confirm_task_material_consumption/)
  assert.match(consumptionQueries, /fetchReservedTaskMaterialLines/)
})

test("34. Movimiento return opcional para devolución", () => {
  assert.match(migration13, /'return'::public\.material_movement_type/)
  assert.match(auditTypes, /MATERIAL_RETURN_CREATED/)
})
