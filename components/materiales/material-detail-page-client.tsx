"use client"

import { useCallback, useEffect, useState } from "react"
import { notFound } from "next/navigation"

import { MaterialDetailView } from "@/components/materiales/material-detail-view"
import type {
  Material,
  MaterialCatalogItem,
  MaterialDetail,
  MaterialInventoryRow,
  WarehouseSelectionContext,
} from "@/lib/types/materials"

type MaterialDetailPageClientProps = {
  id: string
  warehouseId?: string
}

export function MaterialDetailPageClient({
  id,
  warehouseId,
}: MaterialDetailPageClientProps) {
  const [material, setMaterial] = useState<Material | null>(null)
  const [catalog, setCatalog] = useState<MaterialCatalogItem | null>(null)
  const [detail, setDetail] = useState<MaterialDetail | null>(null)
  const [stockLevels, setStockLevels] = useState<MaterialInventoryRow[]>([])
  const [warehouseContext, setWarehouseContext] =
    useState<WarehouseSelectionContext | null>(null)
  const [resolvedWarehouseId, setResolvedWarehouseId] = useState<string | null>(
    null
  )
  const [isLoading, setIsLoading] = useState(true)
  const [notFoundState, setNotFoundState] = useState(false)

  const loadDetail = useCallback(async () => {
    setIsLoading(true)
    setNotFoundState(false)

    const params = new URLSearchParams()
    if (warehouseId) {
      params.set("warehouseId", warehouseId)
    }

    try {
      const [detailResponse, contextResponse] = await Promise.all([
        fetch(
          `/api/materiales/materials/${id}${params.toString() ? `?${params}` : ""}`,
          { cache: "no-store" }
        ),
        fetch("/api/materiales/context", { cache: "no-store" }),
      ])

      if (detailResponse.status === 404) {
        setNotFoundState(true)
        return
      }

      const detailBody = (await detailResponse.json()) as {
        success: boolean
        material?: Material
        catalog?: MaterialCatalogItem
        detail?: MaterialDetail
        stockLevels?: MaterialInventoryRow[]
        warehouseId?: string | null
      }

      if (!detailResponse.ok || !detailBody.success || !detailBody.material) {
        setNotFoundState(true)
        return
      }

      const contextBody = (await contextResponse.json()) as {
        success: boolean
        warehouseContext?: WarehouseSelectionContext
      }

      setMaterial(detailBody.material)
      setCatalog(detailBody.catalog ?? null)
      setDetail(detailBody.detail ?? null)
      setStockLevels(detailBody.stockLevels ?? [])
      setResolvedWarehouseId(detailBody.warehouseId ?? warehouseId ?? null)
      setWarehouseContext(contextBody.warehouseContext ?? null)
    } catch {
      setNotFoundState(true)
    } finally {
      setIsLoading(false)
    }
  }, [id, warehouseId])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Cargando material...</p>
    )
  }

  if (notFoundState || !material || !detail || !catalog) {
    notFound()
  }

  return (
    <MaterialDetailView
      material={material}
      catalog={catalog}
      detail={detail}
      stockLevels={stockLevels}
      warehouseId={resolvedWarehouseId}
      warehouseContext={warehouseContext}
      onRefresh={loadDetail}
    />
  )
}
