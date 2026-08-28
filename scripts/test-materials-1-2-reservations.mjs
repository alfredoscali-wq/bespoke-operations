import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  getTaskMaterialLineReservationDisplay,
  formatInsufficientStockMessage,
} from "../lib/materials/reservation-status.ts"
import { buildInsufficientStockWarning } from "../lib/materials/task-material-lines.validation.ts"
import { computeNetAvailable } from "../lib/materials/stock-status.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const migrationSql = read(
  "supabase/migrations/20261149000108_materials_1_2_reservations.sql"
)
const queriesSql = read("lib/supabase/task-material-lines.queries.ts")
const materialsTableTsx = read("components/materiales/materials-table.tsx")
const taskMaterialsPanelTsx = read("components/materiales/task-materials-panel.tsx")
const assignmentsTabTsx = read("components/materiales/material-tabs/assignments-tab.tsx")
const editorTsx = read("components/materiales/task-material-lines-editor.tsx")
const auditTypesTs = read("lib/audit/types.ts")

test("1. Migración reservas con enum reserved y RPCs", () => {
  assert.match(migrationSql, /ADD VALUE IF NOT EXISTS 'reserved'/)
  assert.match(migrationSql, /apply_material_stock_reservation_delta/)
  assert.match(migrationSql, /reserve_task_material_lines_for_task/)
  assert.match(migrationSql, /release_all_task_material_reservations/)
  assert.match(migrationSql, /tasks_material_reservations_trg/)
  assert.match(migrationSql, /materials_insufficient_stock_message/)
})

test("2. Reserva normal al pasar a asignada vía trigger", () => {
  assert.match(migrationSql, /NEW\.status = 'asignada'/)
  assert.match(migrationSql, /reserve_task_material_lines_for_task_internal/)
})

test("3. Segunda OT valida stock restante (net available)", () => {
  assert.match(migrationSql, /materials_net_available/)
  assert.match(migrationSql, /quantity_reserved \+ p_delta/)
})

test("4. Stock insuficiente bloquea con mensaje estándar", () => {
  const message = formatInsufficientStockMessage({
    available: 1500,
    requested: 2000,
  })
  assert.match(message, /Stock insuficiente/)
  assert.match(message, /1\.500/)
  assert.match(message, /2\.000/)
  assert.match(migrationSql, /Stock insuficiente: disponible/)
})

test("5. Replanificación no libera reserva", () => {
  assert.doesNotMatch(migrationSql, /programada.*release_all_task_material_reservations_internal/s)
  assert.match(migrationSql, /NEW\.status = 'cancelada'/)
})

test("6. Cambio de fecha no toca reservas (sin trigger extra)", () => {
  assert.match(migrationSql, /AFTER UPDATE OF status, deleted_at ON public\.tasks/)
  assert.doesNotMatch(migrationSql, /due_date/)
})

test("7. Cambio de cuadrilla no toca reservas", () => {
  assert.doesNotMatch(migrationSql, /crew/)
})

test("8. Aumento de cantidad ajusta reserva", () => {
  assert.match(migrationSql, /update_task_material_line_with_reservation/)
  assert.match(migrationSql, /v_delta := v_next_qty - v_line\.quantity_planned/)
  assert.match(migrationSql, /IF v_delta > 0 THEN/)
})

test("9. Reducción libera reserva", () => {
  assert.match(migrationSql, /ELSIF v_delta < 0 THEN/)
  assert.match(migrationSql, /v_reservation_action := 'released'/)
})

test("10. Eliminación de material libera reserva", () => {
  assert.match(migrationSql, /remove_task_material_line_with_reservation/)
  assert.match(migrationSql, /release_task_material_line_internal\(v_line\.id, false\)/)
})

test("11. Cancelación de OT libera reservas", () => {
  assert.match(migrationSql, /NEW\.status = 'cancelada'/)
  assert.match(migrationSql, /release_all_task_material_reservations_internal/)
})

test("12. Eliminación de OT libera reservas", () => {
  assert.match(migrationSql, /NEW\.deleted_at IS NOT NULL/)
  assert.match(migrationSql, /release_all_task_material_reservations_internal\(NEW\.id\)/)
})

test("13. Cambio de depósito mueve reserva transaccionalmente", () => {
  assert.match(migrationSql, /v_next_wh IS DISTINCT FROM v_line\.warehouse_id/)
  assert.match(migrationSql, /release_task_material_line_internal\(v_line\.id, false\)/)
  assert.match(migrationSql, /apply_material_stock_reservation_delta\([\s\S]*v_next_wh/)
})

test("14. Reserva concurrente con lock FOR UPDATE", () => {
  assert.match(migrationSql, /lock_material_stock_level/)
  assert.match(migrationSql, /FOR UPDATE/)
})

test("15. Inventario muestra físico/reservado/disponible", () => {
  assert.match(materialsTableTsx, /Stock físico/)
  assert.match(materialsTableTsx, /Reservado/)
  assert.match(materialsTableTsx, /Disponible/)
  assert.match(materialsTableTsx, /quantityAvailable/)
  assert.match(materialsTableTsx, /quantityReserved/)
  assert.match(materialsTableTsx, /netAvailable/)
})

test("16. Detalle material muestra OT reservantes", () => {
  assert.match(assignmentsTabTsx, /Reservas activas/)
  assert.match(assignmentsTabTsx, /activeReservations/)
  assert.match(assignmentsTabTsx, /taskCode/)
  assert.match(assignmentsTabTsx, /customerLabel/)
})

test("17. OT muestra estado de reserva", () => {
  assert.match(taskMaterialsPanelTsx, /getTaskMaterialLineReservationDisplay/)
  assert.match(taskMaterialsPanelTsx, /ReservationStatusBadge/)
  assert.match(taskMaterialsPanelTsx, /display\.label/)
})

test("18. Crear/editar materiales usa RPC sin modificar stock físico", () => {
  assert.match(queriesSql, /create_task_material_line_with_reservation/)
  assert.match(queriesSql, /update_task_material_line_with_reservation/)
  assert.match(queriesSql, /remove_task_material_line_with_reservation/)
  assert.doesNotMatch(migrationSql, /quantity_available = quantity_available -/)
  assert.match(migrationSql, /quantity_reserved \+ p_delta/)
  assert.match(editorTsx, /confirmar o asignar la OT/)
})

test("19. Disponible = físico - reservado", () => {
  assert.equal(computeNetAvailable(2500, 1000), 1500)
  const warning = buildInsufficientStockWarning({
    quantityPlanned: 2000,
    netAvailable: 1500,
    unit: "m",
  })
  assert.match(warning ?? "", /Stock insuficiente/)
})

test("20. Auditoría de reservas definida", () => {
  assert.match(auditTypesTs, /MATERIAL_RESERVATION_CREATED/)
  assert.match(auditTypesTs, /MATERIAL_RESERVATION_UPDATED/)
  assert.match(auditTypesTs, /MATERIAL_RESERVATION_RELEASED/)
})

test("21. Estados UI de reserva", () => {
  assert.deepEqual(getTaskMaterialLineReservationDisplay("planned"), {
    label: "Pendiente de reserva",
    tone: "muted",
  })
  assert.deepEqual(getTaskMaterialLineReservationDisplay("reserved"), {
    label: "Reservado",
    tone: "success",
  })
})

test("22. Queries incluyen líneas reserved en listados activos", () => {
  assert.match(queriesSql, /ACTIVE_LINE_STATUSES/)
  assert.match(queriesSql, /"planned", "reserved"/)
})
