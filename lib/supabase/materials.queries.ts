import type { SupabaseClient } from "@supabase/supabase-js"

import {
  buildCatalogDisplayRows,
} from "@/lib/materials/catalog-display"
import {
  buildInventoryRowsFromStockLevels,
  mapInventoryRow,
  mapMaterialCatalogRow,
  mapMovementRow,
  mapWarehouseRow,
  movementToHistoryEvent,
} from "@/lib/supabase/materials.mapper"
import { buildWarehouseSelectionContext } from "@/lib/materials/warehouse-selection"
import { mapMaterialCodeErrorMessage } from "@/lib/materials/material-code"
import type { Database } from "@/lib/supabase/database.types"
import type {
  MaterialCatalogDisplayRow,
  MaterialCatalogItem,
  MaterialDetail,
  MaterialInventoryRow,
  MaterialMovement,
  MaterialsSummary,
  Warehouse,
  WarehouseSelectionContext,
} from "@/lib/types/materials"
import type {
  CreateMaterialPayload,
  CreateWarehousePayload,
  MaterialsRepositoryResult,
  RecordMaterialMovementPayload,
  UpdateMaterialPayload,
  UpdateWarehousePayload,
} from "@/lib/types/supabase/materials"

export type SupabaseMaterialsClient = SupabaseClient<Database>

const INVENTORY_SELECT =
  "*, material:materials(*), warehouse:warehouses(*)"

const MOVEMENT_SELECT =
  "*, warehouse:warehouses!inner(*), destination_warehouse:warehouses(*), created_by_employee:employees!material_movements_created_by_fkey(first_name, last_name)"

function mapError(error: { code?: string; message: string }) {
  if (error.code === "23505") {
    const duplicateMessage = mapMaterialCodeErrorMessage(error.message)
    if (duplicateMessage !== error.message) {
      return {
        code: "DUPLICATE" as const,
        message: duplicateMessage,
      }
    }
    return {
      code: "DUPLICATE" as const,
      message: "Ya existe un registro con ese código en la empresa.",
    }
  }
  if (error.code === "PGRST116") {
    return {
      code: "NOT_FOUND" as const,
      message: "Registro no encontrado.",
    }
  }
  return {
    code: "UNKNOWN" as const,
    message: error.message,
  }
}

function mapRpcError(message: string) {
  const mapped = mapMaterialCodeErrorMessage(message)
  const lower = mapped.toLowerCase()
  if (
    lower.includes("duplicad") ||
    lower.includes("unique") ||
    lower.includes("ya existe")
  ) {
    return {
      code: "DUPLICATE" as const,
      message: mapped,
    }
  }
  if (lower.includes("no encontrad") || lower.includes("not found")) {
    return {
      code: "NOT_FOUND" as const,
      message: mapped,
    }
  }
  return {
    code: "VALIDATION" as const,
    message: mapped,
  }
}

export async function fetchWarehouses(
  client: SupabaseMaterialsClient,
  companyId: string,
  options?: { activeOnly?: boolean }
): Promise<MaterialsRepositoryResult<Warehouse[]>> {
  let query = client
    .from("warehouses")
    .select("*")
    .eq("company_id", companyId)
    .order("name", { ascending: true })

  if (options?.activeOnly) {
    query = query.eq("active", true)
  }

  const { data, error } = await query

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return { data: (data ?? []).map(mapWarehouseRow), error: null }
}

export async function resolveWarehouseSelection(
  client: SupabaseMaterialsClient,
  companyId: string
): Promise<MaterialsRepositoryResult<WarehouseSelectionContext>> {
  const result = await fetchWarehouses(client, companyId, { activeOnly: true })
  if (result.error || !result.data) {
    return { data: null, error: result.error }
  }

  return {
    data: buildWarehouseSelectionContext(result.data),
    error: null,
  }
}

export async function createWarehouse(
  client: SupabaseMaterialsClient,
  payload: CreateWarehousePayload
): Promise<MaterialsRepositoryResult<Warehouse>> {
  const { data, error } = await client.rpc("create_warehouse", {
    p_name: payload.name,
  })

  if (error) {
    return { data: null, error: mapRpcError(error.message) }
  }

  const row = data as {
    id: string
    companyId: string
    name: string
    active: boolean
    createdAt: string
    updatedAt: string
  }

  return {
    data: {
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      active: row.active,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    error: null,
  }
}

export async function updateWarehouse(
  client: SupabaseMaterialsClient,
  warehouseId: string,
  payload: UpdateWarehousePayload
): Promise<MaterialsRepositoryResult<Warehouse>> {
  const { data, error } = await client.rpc("update_warehouse", {
    p_warehouse_id: warehouseId,
    p_name: payload.name ?? undefined,
    p_active: payload.active ?? undefined,
  })

  if (error) {
    return { data: null, error: mapRpcError(error.message) }
  }

  const row = data as {
    id: string
    companyId: string
    name: string
    active: boolean
    createdAt: string
    updatedAt: string
  }

  return {
    data: {
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      active: row.active,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    error: null,
  }
}

type MaterialRow = Database["public"]["Tables"]["materials"]["Row"]
type WarehouseRow = Database["public"]["Tables"]["warehouses"]["Row"]
type StockLevelWithRelations = Database["public"]["Tables"]["material_stock_levels"]["Row"] & {
  material: MaterialRow
  warehouse: WarehouseRow
}

export async function fetchMaterialIdsWithMovements(
  client: SupabaseMaterialsClient,
  companyId: string
): Promise<Set<string>> {
  const { data, error } = await client
    .from("material_movements")
    .select("material_id")
    .eq("company_id", companyId)

  if (error) {
    return new Set()
  }

  return new Set((data ?? []).map((row) => row.material_id))
}

async function loadInventoryBuildingBlocks(
  client: SupabaseMaterialsClient,
  companyId: string
): Promise<
  MaterialsRepositoryResult<{
    materials: MaterialRow[]
    stockLevels: StockLevelWithRelations[]
    warehouses: WarehouseRow[]
  }>
> {
  const [materialsResult, stockResult, warehousesResult] = await Promise.all([
    client
      .from("materials")
      .select("*")
      .eq("company_id", companyId)
      .eq("active", true),
    client
      .from("material_stock_levels")
      .select(INVENTORY_SELECT)
      .eq("company_id", companyId),
    client.from("warehouses").select("*").eq("company_id", companyId),
  ])

  if (materialsResult.error) {
    return { data: null, error: mapError(materialsResult.error) }
  }
  if (stockResult.error) {
    return { data: null, error: mapError(stockResult.error) }
  }
  if (warehousesResult.error) {
    return { data: null, error: mapError(warehousesResult.error) }
  }

  return {
    data: {
      materials: materialsResult.data ?? [],
      stockLevels: (stockResult.data ?? []) as StockLevelWithRelations[],
      warehouses: warehousesResult.data ?? [],
    },
    error: null,
  }
}

export async function fetchInventoryRows(
  client: SupabaseMaterialsClient,
  companyId: string
): Promise<MaterialsRepositoryResult<MaterialInventoryRow[]>> {
  const blocks = await loadInventoryBuildingBlocks(client, companyId)
  if (blocks.error || !blocks.data) {
    return { data: null, error: blocks.error }
  }

  const rows = buildInventoryRowsFromStockLevels(blocks.data.stockLevels)

  return {
    data: rows,
    error: null,
  }
}

export async function fetchMaterialCatalogItem(
  client: SupabaseMaterialsClient,
  companyId: string,
  materialId: string
): Promise<MaterialsRepositoryResult<MaterialCatalogItem>> {
  const { data, error } = await client
    .from("materials")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", materialId)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Material no encontrado." },
    }
  }

  return { data: mapMaterialCatalogRow(data), error: null }
}

export async function fetchInventoryRowByMaterialAndWarehouse(
  client: SupabaseMaterialsClient,
  companyId: string,
  materialId: string,
  warehouseId: string
): Promise<MaterialsRepositoryResult<MaterialInventoryRow | null>> {
  const { data, error } = await client
    .from("material_stock_levels")
    .select(INVENTORY_SELECT)
    .eq("company_id", companyId)
    .eq("material_id", materialId)
    .eq("warehouse_id", warehouseId)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return { data: data ? mapInventoryRow(data) : null, error: null }
}

export async function fetchInventoryRowsForMaterial(
  client: SupabaseMaterialsClient,
  companyId: string,
  materialId: string
): Promise<MaterialsRepositoryResult<MaterialInventoryRow[]>> {
  const [materialResult, stockResult, warehousesResult] = await Promise.all([
    client
      .from("materials")
      .select("*")
      .eq("company_id", companyId)
      .eq("id", materialId)
      .maybeSingle(),
    client
      .from("material_stock_levels")
      .select(INVENTORY_SELECT)
      .eq("company_id", companyId)
      .eq("material_id", materialId),
    client.from("warehouses").select("*").eq("company_id", companyId),
  ])

  if (materialResult.error) {
    return { data: null, error: mapError(materialResult.error) }
  }
  if (stockResult.error) {
    return { data: null, error: mapError(stockResult.error) }
  }
  if (warehousesResult.error) {
    return { data: null, error: mapError(warehousesResult.error) }
  }

  if (!materialResult.data) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Material no encontrado." },
    }
  }

  const rows = (stockResult.data ?? []).map((row) =>
    mapInventoryRow(row as StockLevelWithRelations)
  )

  if (!materialResult.data.active) {
    return { data: rows, error: null }
  }

  return { data: rows, error: null }
}

export async function createMaterial(
  client: SupabaseMaterialsClient,
  companyId: string,
  payload: CreateMaterialPayload
): Promise<MaterialsRepositoryResult<MaterialCatalogItem>> {
  const { data, error } = await client.rpc("create_material", {
    p_code: payload.code,
    p_name: payload.name,
    p_category: payload.category,
    p_unit: payload.unit,
    p_min_stock: payload.minStock ?? 0,
    p_type: payload.type ?? "consumable",
    p_manufacturer: payload.manufacturer ?? "",
    p_description: payload.description ?? "",
    p_active: payload.active ?? true,
  })

  if (error) {
    return { data: null, error: mapRpcError(error.message) }
  }

  return fetchMaterialCatalogItem(client, companyId, (data as { id: string }).id)
}

export async function fetchMaterialCatalog(
  client: SupabaseMaterialsClient,
  companyId: string,
  options?: { activeOnly?: boolean }
): Promise<MaterialsRepositoryResult<MaterialCatalogItem[]>> {
  let query = client
    .from("materials")
    .select("*")
    .eq("company_id", companyId)
    .order("code", { ascending: true })

  if (options?.activeOnly) {
    query = query.eq("active", true)
  }

  const { data, error } = await query

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return {
    data: (data ?? []).map(mapMaterialCatalogRow),
    error: null,
  }
}

export async function fetchCatalogDisplayRows(
  client: SupabaseMaterialsClient,
  companyId: string
): Promise<MaterialsRepositoryResult<MaterialCatalogDisplayRow[]>> {
  const [catalogResult, inventoryResult, movementMaterialIds] = await Promise.all([
    fetchMaterialCatalog(client, companyId, { activeOnly: true }),
    fetchInventoryRows(client, companyId),
    fetchMaterialIdsWithMovements(client, companyId),
  ])

  if (catalogResult.error || !catalogResult.data) {
    return { data: null, error: catalogResult.error }
  }
  if (inventoryResult.error || !inventoryResult.data) {
    return { data: null, error: inventoryResult.error }
  }

  return {
    data: buildCatalogDisplayRows(
      catalogResult.data,
      inventoryResult.data,
      movementMaterialIds
    ),
    error: null,
  }
}

export async function updateMaterial(
  client: SupabaseMaterialsClient,
  companyId: string,
  materialId: string,
  payload: UpdateMaterialPayload
): Promise<MaterialsRepositoryResult<MaterialCatalogItem>> {
  const { error } = await client.rpc("update_material", {
    p_material_id: materialId,
    p_code: payload.code,
    p_name: payload.name,
    p_category: payload.category,
    p_unit: payload.unit,
    p_min_stock: payload.minStock,
    p_type: payload.type,
    p_manufacturer: payload.manufacturer,
    p_description: payload.description,
    p_active: payload.active,
    p_photo_attachment_id: payload.photoAttachmentId ?? undefined,
    p_clear_photo: payload.clearPhoto ?? false,
  })

  if (error) {
    return { data: null, error: mapRpcError(error.message) }
  }

  return fetchMaterialCatalogItem(client, companyId, materialId)
}

export async function deleteMaterial(
  client: SupabaseMaterialsClient,
  companyId: string,
  materialId: string
): Promise<MaterialsRepositoryResult<MaterialCatalogItem>> {
  const { error } = await client.rpc("delete_material", {
    p_material_id: materialId,
  })

  if (error) {
    return { data: null, error: mapRpcError(error.message) }
  }

  return fetchMaterialCatalogItem(client, companyId, materialId)
}

export async function fetchMaterialMovements(
  client: SupabaseMaterialsClient,
  companyId: string,
  materialId: string,
  warehouseId?: string
): Promise<MaterialsRepositoryResult<MaterialMovement[]>> {
  let query = client
    .from("material_movements")
    .select(MOVEMENT_SELECT)
    .eq("company_id", companyId)
    .eq("material_id", materialId)
    .order("created_at", { ascending: false })

  if (warehouseId) {
    query = query.or(
      `warehouse_id.eq.${warehouseId},destination_warehouse_id.eq.${warehouseId}`
    )
  }

  const { data, error } = await query

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return {
    data: (data ?? []).map((row) =>
      mapMovementRow(row as unknown as Parameters<typeof mapMovementRow>[0])
    ),
    error: null,
  }
}

export async function fetchMaterialDetail(
  client: SupabaseMaterialsClient,
  companyId: string,
  materialId: string,
  warehouseId?: string
): Promise<MaterialsRepositoryResult<MaterialDetail>> {
  const movementsResult = await fetchMaterialMovements(
    client,
    companyId,
    materialId,
    warehouseId
  )

  if (movementsResult.error || !movementsResult.data) {
    return { data: null, error: movementsResult.error }
  }

  const stockResult = await fetchInventoryRowsForMaterial(
    client,
    companyId,
    materialId
  )

  if (stockResult.error || !stockResult.data) {
    return { data: null, error: stockResult.error }
  }

  const totalReserved = stockResult.data.reduce(
    (sum, row) => sum + row.quantityReserved,
    0
  )

  const movements = movementsResult.data
  const history = movements.map(movementToHistoryEvent)

  return {
    data: {
      movements,
      assignments: [],
      history,
      stats: {
        assignedQuantity: 0,
        totalMovements: movements.length,
        lastMovementAt: movements[0]?.timestamp ?? null,
        totalReserved,
      },
    },
    error: null,
  }
}

export async function recordMaterialMovement(
  client: SupabaseMaterialsClient,
  payload: RecordMaterialMovementPayload
): Promise<MaterialsRepositoryResult<{ movementId: string }>> {
  let rpcResult: { data: unknown; error: { message: string } | null }

  switch (payload.movementType) {
    case "entry":
      rpcResult = await client.rpc("record_material_stock_entry", {
        p_material_id: payload.materialId,
        p_warehouse_id: payload.warehouseId,
        p_quantity: payload.quantity,
        p_notes: payload.notes ?? "",
      })
      break
    case "exit":
      rpcResult = await client.rpc("record_material_stock_exit", {
        p_material_id: payload.materialId,
        p_warehouse_id: payload.warehouseId,
        p_quantity: payload.quantity,
        p_notes: payload.notes ?? "",
      })
      break
    case "transfer":
      if (!payload.destinationWarehouseId) {
        return {
          data: null,
          error: {
            code: "VALIDATION",
            message: "Debe indicar el depósito destino.",
          },
        }
      }
      rpcResult = await client.rpc("record_material_stock_transfer", {
        p_material_id: payload.materialId,
        p_warehouse_id: payload.warehouseId,
        p_destination_warehouse_id: payload.destinationWarehouseId,
        p_quantity: payload.quantity,
        p_notes: payload.notes ?? "",
      })
      break
    case "adjustment":
      if (payload.newQuantity === undefined) {
        return {
          data: null,
          error: {
            code: "VALIDATION",
            message: "Debe indicar el nuevo stock.",
          },
        }
      }
      rpcResult = await client.rpc("record_material_stock_adjustment", {
        p_material_id: payload.materialId,
        p_warehouse_id: payload.warehouseId,
        p_new_quantity: payload.newQuantity,
        p_notes: payload.notes ?? "",
      })
      break
    default:
      return {
        data: null,
        error: { code: "VALIDATION", message: "Tipo de movimiento inválido." },
      }
  }

  if (rpcResult.error) {
    return { data: null, error: mapRpcError(rpcResult.error.message) }
  }

  const data = rpcResult.data as { movementId: string }
  return { data: { movementId: data.movementId }, error: null }
}

export async function fetchMaterialsSummary(
  client: SupabaseMaterialsClient,
  companyId: string
): Promise<MaterialsRepositoryResult<MaterialsSummary>> {
  const today = new Date().toISOString().slice(0, 10)

  const [blocks, movementsResult] = await Promise.all([
    loadInventoryBuildingBlocks(client, companyId),
    client
      .from("material_movements")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("created_at", `${today}T00:00:00`)
      .lt("created_at", `${today}T23:59:59.999`),
  ])

  if (blocks.error || !blocks.data) {
    return { data: null, error: blocks.error }
  }
  if (movementsResult.error) {
    return { data: null, error: mapError(movementsResult.error) }
  }

  const inventory = buildInventoryRowsFromStockLevels(blocks.data.stockLevels)

  const lowStockMaterialIds = new Set(
    inventory
      .filter(
        (row) => row.status === "low-stock" || row.status === "out-of-stock"
      )
      .map((row) => row.materialId)
  )

  const reservedQuantity = inventory.reduce(
    (sum, row) => sum + row.quantityReserved,
    0
  )

  return {
    data: {
      totalMaterials: blocks.data.materials.length,
      lowStockItems: lowStockMaterialIds.size,
      todaysMovements: movementsResult.count ?? 0,
      reservedQuantity,
    },
    error: null,
  }
}
