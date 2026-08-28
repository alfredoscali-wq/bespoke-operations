import { NextResponse } from "next/server"

import {
  requireMaterialsMutationContext,
  requireMaterialsReadContext,
} from "@/lib/materials/route-context"
import {
  deleteMaterial,
  fetchInventoryRowsForMaterial,
  fetchMaterialCatalogItem,
  fetchMaterialDetail,
  updateMaterial,
} from "@/lib/supabase/materials.queries"
import { mapInventoryRowToLegacyMaterial } from "@/lib/supabase/materials.mapper"
import { createClient } from "@/lib/supabase/server"
import type { UpdateMaterialPayload } from "@/lib/types/supabase/materials"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireMaterialsReadContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const url = new URL(request.url)
  const warehouseId = url.searchParams.get("warehouseId")?.trim() || undefined

  const client = await createClient()

  const [catalogResult, detailResult, stockResult] = await Promise.all([
    fetchMaterialCatalogItem(client, auth.companyId, id),
    fetchMaterialDetail(client, auth.companyId, id, warehouseId),
    fetchInventoryRowsForMaterial(client, auth.companyId, id),
  ])

  if (catalogResult.error || !catalogResult.data) {
    return NextResponse.json(
      {
        success: false,
        message: catalogResult.error?.message ?? "Material no encontrado.",
      },
      { status: catalogResult.error?.code === "NOT_FOUND" ? 404 : 500 }
    )
  }

  if (detailResult.error || !detailResult.data) {
    return NextResponse.json(
      {
        success: false,
        message: detailResult.error?.message ?? "No se pudo cargar el detalle.",
      },
      { status: 500 }
    )
  }

  const stockRows = stockResult.data ?? []
  const selectedStock =
    warehouseId
      ? stockRows.find((row) => row.warehouseId === warehouseId)
      : stockRows[0]

  const material = selectedStock
    ? mapInventoryRowToLegacyMaterial(selectedStock)
    : {
        id: catalogResult.data.id,
        code: catalogResult.data.code,
        name: catalogResult.data.name,
        category: catalogResult.data.category,
        stock: 0,
        minStock: catalogResult.data.minStock,
        unit: catalogResult.data.unit,
        warehouse: warehouseId
          ? stockRows.find((r) => r.warehouseId === warehouseId)?.warehouse ??
            "—"
          : "—",
        status: catalogResult.data.active ? "out-of-stock" : "discontinued",
        description: catalogResult.data.description,
        manufacturer: catalogResult.data.manufacturer,
        itemType: catalogResult.data.itemType,
        materialId: catalogResult.data.id,
      }

  return NextResponse.json({
    success: true,
    material,
    catalog: catalogResult.data,
    detail: detailResult.data,
    stockLevels: stockRows,
    warehouseId: selectedStock?.warehouseId ?? warehouseId ?? null,
  })
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireMaterialsMutationContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params

  let payload: UpdateMaterialPayload
  try {
    payload = (await request.json()) as UpdateMaterialPayload
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const client = await createClient()
  const result = await updateMaterial(client, auth.companyId, id, payload)

  if (result.error || !result.data) {
    const status =
      result.error?.code === "VALIDATION" ||
      result.error?.code === "DUPLICATE" ||
      result.error?.code === "NOT_FOUND"
        ? 400
        : 500
    return NextResponse.json(
      {
        success: false,
        message: result.error?.message ?? "No se pudo actualizar el material.",
      },
      { status }
    )
  }

  return NextResponse.json({
    success: true,
    material: result.data,
  })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireMaterialsMutationContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params

  const client = await createClient()
  const result = await deleteMaterial(client, auth.companyId, id)

  if (result.error || !result.data) {
    const status =
      result.error?.code === "VALIDATION" ||
      result.error?.code === "DUPLICATE" ||
      result.error?.code === "NOT_FOUND"
        ? 400
        : 500
    return NextResponse.json(
      {
        success: false,
        message:
          result.error?.message ?? "No se pudo eliminar el material del catálogo.",
      },
      { status }
    )
  }

  return NextResponse.json({
    success: true,
    material: result.data,
    message: "Material eliminado del catálogo.",
  })
}
