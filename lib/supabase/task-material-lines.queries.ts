import type { SupabaseClient } from "@supabase/supabase-js"

import { computeNetAvailable } from "@/lib/materials/stock-status"
import {
  unitsMatchCatalog,
  validateTaskMaterialLineQuantity,
} from "@/lib/materials/task-material-lines.validation"
import type { Database } from "@/lib/supabase/database.types"
import {
  mapTaskMaterialLineRow,
  mapTaskMaterialLineViewRow,
} from "@/lib/supabase/task-material-lines.mapper"
import type { TaskMaterialLine, TaskMaterialLineView } from "@/lib/types/materials"
import type {
  CreateTaskMaterialLinePayload,
  TaskMaterialLinesRepositoryResult,
  UpdateTaskMaterialLinePayload,
} from "@/lib/types/supabase/task-material-lines"

export type SupabaseTaskMaterialLinesClient = SupabaseClient<Database>

const ACTIVE_LINE_STATUSES = ["planned", "reserved"] as const

const LINE_SELECT =
  "*, material:materials(code, name, unit, active), warehouse:warehouses(name, active)"

type StockSnapshot = {
  quantityAvailable: number | null
  quantityReserved: number | null
  netAvailable: number | null
}

type RpcLinePayload = {
  line: Database["public"]["Tables"]["task_material_lines"]["Row"]
  reservationAction?: string | null
}

function mapError(
  error: { code?: string; message: string },
  fallback = "No se pudo completar la operación."
): TaskMaterialLinesRepositoryResult<never>["error"] {
  const message = error.message || fallback
  if (error.code === "PGRST116") {
    return { code: "NOT_FOUND", message: "Línea de material no encontrada." }
  }
  if (message.includes("TASK_NOT_FOUND") || message.includes("Orden de trabajo no encontrada")) {
    return { code: "NOT_FOUND", message: "Orden de trabajo no encontrada." }
  }
  if (message.includes("MATERIAL_NOT_FOUND") || message.includes("Material no encontrado")) {
    return { code: "NOT_FOUND", message: "Material no encontrado." }
  }
  if (message.includes("WAREHOUSE_NOT_FOUND") || message.includes("Depósito no encontrado")) {
    return { code: "NOT_FOUND", message: "Depósito no encontrado o inactivo." }
  }
  if (message.includes("Stock insuficiente")) {
    return { code: "VALIDATION", message }
  }
  if (
    message.includes("COMPANY_MISMATCH") ||
    message.includes("Operación no permitida") ||
    message.includes("row-level security")
  ) {
    return { code: "FORBIDDEN", message: "Operación no permitida para esta empresa." }
  }
  if (
    message.includes("cancelada") ||
    message.includes("no soportado") ||
    message.includes("No se puede editar")
  ) {
    return { code: "CONFLICT", message }
  }
  return { code: "UNKNOWN", message }
}

async function resolveStockSnapshot(
  client: SupabaseTaskMaterialLinesClient,
  companyId: string,
  materialId: string,
  warehouseId: string
): Promise<StockSnapshot> {
  const { data } = await client
    .from("material_stock_levels")
    .select("quantity_available, quantity_reserved")
    .eq("company_id", companyId)
    .eq("material_id", materialId)
    .eq("warehouse_id", warehouseId)
    .maybeSingle()

  if (!data) {
    return {
      quantityAvailable: null,
      quantityReserved: null,
      netAvailable: null,
    }
  }

  const quantityAvailable = Number(data.quantity_available)
  const quantityReserved = Number(data.quantity_reserved)
  const safeAvailable = Number.isFinite(quantityAvailable) ? quantityAvailable : 0
  const safeReserved = Number.isFinite(quantityReserved) ? quantityReserved : 0

  return {
    quantityAvailable: safeAvailable,
    quantityReserved: safeReserved,
    netAvailable: computeNetAvailable(safeAvailable, safeReserved),
  }
}

async function mapLineWithStock(
  client: SupabaseTaskMaterialLinesClient,
  companyId: string,
  row: Parameters<typeof mapTaskMaterialLineViewRow>[0]
): Promise<TaskMaterialLineView> {
  const stock = await resolveStockSnapshot(
    client,
    companyId,
    row.material_id,
    row.warehouse_id
  )
  return mapTaskMaterialLineViewRow(row, stock)
}

async function assertTaskInCompany(
  client: SupabaseTaskMaterialLinesClient,
  taskId: string,
  companyId: string
): Promise<TaskMaterialLinesRepositoryResult<void>> {
  const { data, error } = await client
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapError(error) }
  }
  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Orden de trabajo no encontrada." },
    }
  }
  return { data: undefined, error: null }
}

async function resolveActiveMaterial(
  client: SupabaseTaskMaterialLinesClient,
  materialId: string,
  companyId: string
) {
  const { data, error } = await client
    .from("materials")
    .select("id, unit, active")
    .eq("id", materialId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (error) {
    return { error: mapError(error), material: null }
  }
  if (!data || !data.active) {
    return {
      error: {
        code: "NOT_FOUND" as const,
        message: "Material no encontrado en el catálogo.",
      },
      material: null,
    }
  }
  return { error: null, material: data }
}

async function resolveActiveWarehouse(
  client: SupabaseTaskMaterialLinesClient,
  warehouseId: string,
  companyId: string
) {
  const { data, error } = await client
    .from("warehouses")
    .select("id, active")
    .eq("id", warehouseId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (error) {
    return { error: mapError(error), warehouse: null }
  }
  if (!data || !data.active) {
    return {
      error: {
        code: "NOT_FOUND" as const,
        message: "Depósito no encontrado o inactivo.",
      },
      warehouse: null,
    }
  }
  return { error: null, warehouse: data }
}

function parseRpcLinePayload(data: unknown): RpcLinePayload | null {
  if (!data || typeof data !== "object") return null
  const record = data as Record<string, unknown>
  if (!record.line || typeof record.line !== "object") return null
  return {
    line: record.line as Database["public"]["Tables"]["task_material_lines"]["Row"],
    reservationAction:
      typeof record.reservationAction === "string" ? record.reservationAction : null,
  }
}

export async function fetchTaskMaterialLines(
  client: SupabaseTaskMaterialLinesClient,
  companyId: string,
  taskId: string
): Promise<TaskMaterialLinesRepositoryResult<TaskMaterialLineView[]>> {
  const taskCheck = await assertTaskInCompany(client, taskId, companyId)
  if (taskCheck.error) {
    return { data: null, error: taskCheck.error }
  }

  const { data, error } = await client
    .from("task_material_lines")
    .select(LINE_SELECT)
    .eq("company_id", companyId)
    .eq("task_id", taskId)
    .in("status", [...ACTIVE_LINE_STATUSES])
    .order("created_at", { ascending: true })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  const views: TaskMaterialLineView[] = []
  for (const row of data ?? []) {
    views.push(await mapLineWithStock(client, companyId, row))
  }

  return { data: views, error: null }
}

export async function createTaskMaterialLine(
  client: SupabaseTaskMaterialLinesClient,
  companyId: string,
  taskId: string,
  payload: CreateTaskMaterialLinePayload
): Promise<
  TaskMaterialLinesRepositoryResult<
    TaskMaterialLineView & { reservationAction?: string | null }
  >
> {
  const taskCheck = await assertTaskInCompany(client, taskId, companyId)
  if (taskCheck.error) {
    return { data: null, error: taskCheck.error }
  }

  const materialResult = await resolveActiveMaterial(
    client,
    payload.materialId,
    companyId
  )
  if (materialResult.error || !materialResult.material) {
    return { data: null, error: materialResult.error }
  }

  const warehouseResult = await resolveActiveWarehouse(
    client,
    payload.warehouseId,
    companyId
  )
  if (warehouseResult.error || !warehouseResult.warehouse) {
    return { data: null, error: warehouseResult.error }
  }

  const quantityValidation = validateTaskMaterialLineQuantity(
    materialResult.material.unit,
    payload.quantityPlanned
  )
  if (!quantityValidation.ok) {
    return {
      data: null,
      error: { code: "VALIDATION", message: quantityValidation.message },
    }
  }

  const { data, error } = await client.rpc("create_task_material_line_with_reservation", {
    p_task_id: taskId,
    p_material_id: payload.materialId,
    p_warehouse_id: payload.warehouseId,
    p_quantity_planned: quantityValidation.quantity,
    p_unit: materialResult.material.unit.trim(),
    p_notes: payload.notes ?? null,
  })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  const parsed = parseRpcLinePayload(data)
  if (!parsed) {
    return {
      data: null,
      error: { code: "UNKNOWN", message: "No se pudo crear la línea." },
    }
  }

  const { data: joined, error: joinError } = await client
    .from("task_material_lines")
    .select(LINE_SELECT)
    .eq("id", parsed.line.id)
    .single()

  if (joinError || !joined) {
    return { data: null, error: mapError(joinError ?? { message: "No se pudo crear la línea." }) }
  }

  const view = await mapLineWithStock(client, companyId, joined)
  return {
    data: { ...view, reservationAction: parsed.reservationAction },
    error: null,
  }
}

export async function updateTaskMaterialLine(
  client: SupabaseTaskMaterialLinesClient,
  companyId: string,
  taskId: string,
  lineId: string,
  payload: UpdateTaskMaterialLinePayload
): Promise<
  TaskMaterialLinesRepositoryResult<
    TaskMaterialLineView & { reservationAction?: string | null }
  >
> {
  const { data: existing, error: fetchError } = await client
    .from("task_material_lines")
    .select(LINE_SELECT)
    .eq("id", lineId)
    .eq("company_id", companyId)
    .eq("task_id", taskId)
    .maybeSingle()

  if (fetchError) {
    return { data: null, error: mapError(fetchError) }
  }
  if (!existing) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Línea de material no encontrada." },
    }
  }

  const materialUnit = existing.material?.unit ?? existing.unit

  if (payload.warehouseId) {
    const warehouseResult = await resolveActiveWarehouse(
      client,
      payload.warehouseId,
      companyId
    )
    if (warehouseResult.error) {
      return { data: null, error: warehouseResult.error }
    }
  }

  let nextQuantity: number | undefined
  if (payload.quantityPlanned !== undefined) {
    const quantityValidation = validateTaskMaterialLineQuantity(
      materialUnit,
      payload.quantityPlanned
    )
    if (!quantityValidation.ok) {
      return {
        data: null,
        error: { code: "VALIDATION", message: quantityValidation.message },
      }
    }
    nextQuantity = quantityValidation.quantity
  }

  if (
    payload.quantityPlanned === undefined &&
    payload.warehouseId === undefined &&
    payload.notes === undefined
  ) {
    const view = await mapLineWithStock(client, companyId, existing)
    return { data: view, error: null }
  }

  const { data, error } = await client.rpc("update_task_material_line_with_reservation", {
    p_task_id: taskId,
    p_line_id: lineId,
    p_quantity_planned: nextQuantity ?? null,
    p_warehouse_id: payload.warehouseId ?? null,
    p_notes: payload.notes ?? null,
  })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  const parsed = parseRpcLinePayload(data)
  if (!parsed) {
    return {
      data: null,
      error: { code: "UNKNOWN", message: "No se pudo actualizar la línea." },
    }
  }

  const { data: joined, error: joinError } = await client
    .from("task_material_lines")
    .select(LINE_SELECT)
    .eq("id", lineId)
    .single()

  if (joinError || !joined) {
    return {
      data: null,
      error: mapError(joinError ?? { message: "No se pudo actualizar la línea." }),
    }
  }

  if (!unitsMatchCatalog(materialUnit, joined.unit)) {
    await client
      .from("task_material_lines")
      .update({ unit: materialUnit.trim() })
      .eq("id", lineId)
    joined.unit = materialUnit.trim()
  }

  const view = await mapLineWithStock(client, companyId, joined)
  return {
    data: { ...view, reservationAction: parsed.reservationAction },
    error: null,
  }
}

export async function deleteTaskMaterialLine(
  client: SupabaseTaskMaterialLinesClient,
  companyId: string,
  taskId: string,
  lineId: string
): Promise<
  TaskMaterialLinesRepositoryResult<
    TaskMaterialLine & { reservationAction?: string | null }
  >
> {
  const { data: existing, error: fetchError } = await client
    .from("task_material_lines")
    .select("*")
    .eq("id", lineId)
    .eq("company_id", companyId)
    .eq("task_id", taskId)
    .maybeSingle()

  if (fetchError) {
    return { data: null, error: mapError(fetchError) }
  }
  if (!existing) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Línea de material no encontrada." },
    }
  }
  if (existing.status === "cancelled") {
    return {
      data: null,
      error: {
        code: "CONFLICT",
        message: "La línea ya fue eliminada.",
      },
    }
  }

  const { data, error } = await client.rpc("remove_task_material_line_with_reservation", {
    p_task_id: taskId,
    p_line_id: lineId,
  })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  const record = data as { reservationAction?: string | null } | null
  const mapped = mapTaskMaterialLineRow(existing)
  return {
    data: {
      ...mapped,
      reservationAction:
        record && typeof record.reservationAction === "string"
          ? record.reservationAction
          : null,
    },
    error: null,
  }
}

export async function fetchTaskMaterialLinesForTasks(
  client: SupabaseTaskMaterialLinesClient,
  companyId: string,
  taskIds: string[]
): Promise<TaskMaterialLinesRepositoryResult<Record<string, TaskMaterialLineView[]>>> {
  if (taskIds.length === 0) {
    return { data: {}, error: null }
  }

  const { data, error } = await client
    .from("task_material_lines")
    .select(LINE_SELECT)
    .eq("company_id", companyId)
    .in("task_id", taskIds)
    .in("status", [...ACTIVE_LINE_STATUSES])
    .order("created_at", { ascending: true })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  const grouped: Record<string, TaskMaterialLineView[]> = {}
  for (const row of data ?? []) {
    const view = await mapLineWithStock(client, companyId, row)
    if (!grouped[row.task_id]) {
      grouped[row.task_id] = []
    }
    grouped[row.task_id].push(view)
  }

  return { data: grouped, error: null }
}

export async function fetchReservedTaskMaterialLinesForTask(
  client: SupabaseTaskMaterialLinesClient,
  companyId: string,
  taskId: string
): Promise<TaskMaterialLinesRepositoryResult<TaskMaterialLineView[]>> {
  const { data, error } = await client
    .from("task_material_lines")
    .select(LINE_SELECT)
    .eq("company_id", companyId)
    .eq("task_id", taskId)
    .eq("status", "reserved")
    .order("created_at", { ascending: true })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  const views: TaskMaterialLineView[] = []
  for (const row of data ?? []) {
    views.push(await mapLineWithStock(client, companyId, row))
  }

  return { data: views, error: null }
}
