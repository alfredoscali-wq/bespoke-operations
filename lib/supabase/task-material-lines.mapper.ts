import type { Database } from "@/lib/supabase/database.types"
import type { TaskMaterialLine, TaskMaterialLineView } from "@/lib/types/materials"

type TaskMaterialLineRow = Database["public"]["Tables"]["task_material_lines"]["Row"]

type TaskMaterialLineRowWithRelations = TaskMaterialLineRow & {
  material: {
    code: string
    name: string
    unit: string
    active: boolean
  } | null
  warehouse: {
    name: string
    active: boolean
  } | null
}

function parseNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function mapTaskMaterialLineRow(row: TaskMaterialLineRow): TaskMaterialLine {
  return {
    id: row.id,
    companyId: row.company_id,
    taskId: row.task_id,
    materialId: row.material_id,
    warehouseId: row.warehouse_id,
    quantityPlanned: parseNumber(row.quantity_planned),
    quantityConsumed:
      row.quantity_consumed === null || row.quantity_consumed === undefined
        ? null
        : parseNumber(row.quantity_consumed),
    quantityReturned:
      row.quantity_returned === null || row.quantity_returned === undefined
        ? null
        : parseNumber(row.quantity_returned),
    unit: row.unit,
    notes: row.notes,
    status: row.status,
    materialsConfirmedAt: row.materials_confirmed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapTaskMaterialLineViewRow(
  row: TaskMaterialLineRowWithRelations,
  stock: {
    quantityAvailable?: number | null
    quantityReserved?: number | null
    netAvailable?: number | null
  } | number | null = null
): TaskMaterialLineView {
  const base = mapTaskMaterialLineRow(row)
  const stockSnapshot =
    typeof stock === "number" || stock === null
      ? {
          quantityAvailable: null,
          quantityReserved: null,
          netAvailable: stock,
        }
      : {
          quantityAvailable: stock.quantityAvailable ?? null,
          quantityReserved: stock.quantityReserved ?? null,
          netAvailable: stock.netAvailable ?? null,
        }

  return {
    ...base,
    materialCode: row.material?.code?.trim() || "—",
    materialName: row.material?.name?.trim() || "—",
    warehouseName: row.warehouse?.name?.trim() || "—",
    quantityAvailable: stockSnapshot.quantityAvailable,
    quantityReserved: stockSnapshot.quantityReserved,
    netAvailable: stockSnapshot.netAvailable,
    quantityReservedForLine:
      base.status === "reserved" || base.status === "consumed"
        ? base.quantityPlanned
        : null,
  }
}

export type TaskMaterialLineInsert =
  Database["public"]["Tables"]["task_material_lines"]["Insert"]

export function buildTaskMaterialLineInsert(input: {
  companyId: string
  taskId: string
  materialId: string
  warehouseId: string
  quantityPlanned: number
  unit: string
  notes?: string | null
}): TaskMaterialLineInsert {
  return {
    company_id: input.companyId,
    task_id: input.taskId,
    material_id: input.materialId,
    warehouse_id: input.warehouseId,
    quantity_planned: input.quantityPlanned,
    unit: input.unit,
    notes: input.notes?.trim() || null,
    status: "planned",
  }
}
