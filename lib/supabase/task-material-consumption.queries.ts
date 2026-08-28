import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import {
  mapTaskMaterialLineViewRow,
} from "@/lib/supabase/task-material-lines.mapper"
import type { TaskMaterialLineView } from "@/lib/types/materials"
import type { ConsumptionLineInput } from "@/lib/materials/task-material-consumption"

export type SupabaseTaskMaterialConsumptionClient = SupabaseClient<Database>

const LINE_SELECT =
  "*, material:materials(code, name, unit, active), warehouse:warehouses(name, active)"

export type ConfirmMaterialConsumptionResult = {
  taskId: string
  skipped: boolean
  reason?: string
  lines: Array<{
    lineId: string
    quantityConsumed: number
    quantityReturned: number
  }>
}

function mapConsumptionError(message: string) {
  if (message.includes("MATERIAL_CONSUMPTION_REQUIRED")) {
    return {
      code: "CONFLICT" as const,
      message:
        "Debe confirmar los materiales utilizados antes de finalizar la OT.",
    }
  }
  if (
    message.includes("no puede superar") ||
    message.includes("negativa") ||
    message.includes("entero") ||
    message.includes("pendiente de cierre")
  ) {
    return { code: "VALIDATION" as const, message }
  }
  if (message.includes("no encontrada") || message.includes("NOT_FOUND")) {
    return { code: "NOT_FOUND" as const, message }
  }
  if (message.includes("permiso") || message.includes("row-level security")) {
    return {
      code: "FORBIDDEN" as const,
      message: "Operación no permitida para esta empresa.",
    }
  }
  return { code: "UNKNOWN" as const, message }
}

export async function fetchReservedTaskMaterialLines(
  client: SupabaseTaskMaterialConsumptionClient,
  companyId: string,
  taskId: string
): Promise<{
  data: TaskMaterialLineView[] | null
  error: { code: string; message: string } | null
}> {
  const { data, error } = await client
    .from("task_material_lines")
    .select(LINE_SELECT)
    .eq("company_id", companyId)
    .eq("task_id", taskId)
    .eq("status", "reserved")
    .order("created_at", { ascending: true })

  if (error) {
    return { data: null, error: mapConsumptionError(error.message) }
  }

  return {
    data: (data ?? []).map((row) =>
      mapTaskMaterialLineViewRow(row, {
        quantityAvailable: null,
        quantityReserved: null,
        netAvailable: null,
      })
    ),
    error: null,
  }
}

export async function fetchTaskMaterialLinesForTaskDetail(
  client: SupabaseTaskMaterialConsumptionClient,
  companyId: string,
  taskId: string
): Promise<{
  data: TaskMaterialLineView[] | null
  error: { code: string; message: string } | null
}> {
  const { data, error } = await client
    .from("task_material_lines")
    .select(LINE_SELECT)
    .eq("company_id", companyId)
    .eq("task_id", taskId)
    .in("status", ["planned", "reserved", "consumed"])
    .order("created_at", { ascending: true })

  if (error) {
    return { data: null, error: mapConsumptionError(error.message) }
  }

  return {
    data: (data ?? []).map((row) =>
      mapTaskMaterialLineViewRow(row, {
        quantityAvailable: null,
        quantityReserved: null,
        netAvailable: null,
      })
    ),
    error: null,
  }
}

export async function confirmTaskMaterialConsumption(
  client: SupabaseTaskMaterialConsumptionClient,
  taskId: string,
  input: { useAll: boolean; lines?: ConsumptionLineInput[] }
): Promise<{
  data: ConfirmMaterialConsumptionResult | null
  error: { code: string; message: string } | null
}> {
  const { data, error } = await client.rpc("confirm_task_material_consumption", {
    p_task_id: taskId,
    p_use_all: input.useAll,
    p_lines: input.useAll
      ? []
      : (input.lines ?? []).map((line) => ({
          lineId: line.lineId,
          quantityConsumed: line.quantityConsumed,
        })),
  })

  if (error) {
    return { data: null, error: mapConsumptionError(error.message) }
  }

  const record = data as Record<string, unknown> | null
  if (!record) {
    return {
      data: null,
      error: { code: "UNKNOWN", message: "No se pudo confirmar el consumo." },
    }
  }

  return {
    data: {
      taskId: String(record.taskId ?? taskId),
      skipped: Boolean(record.skipped),
      reason: typeof record.reason === "string" ? record.reason : undefined,
      lines: Array.isArray(record.lines)
        ? (record.lines as ConfirmMaterialConsumptionResult["lines"])
        : [],
    },
    error: null,
  }
}

export async function taskHasReservedCatalogLines(
  client: SupabaseTaskMaterialConsumptionClient,
  taskId: string
): Promise<boolean> {
  const { data, error } = await client.rpc(
    "task_has_reserved_catalog_material_lines",
    { p_task_id: taskId }
  )

  if (error) return false
  return Boolean(data)
}
