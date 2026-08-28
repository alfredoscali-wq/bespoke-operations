"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowDownToLine, Package, Warehouse } from "lucide-react"

import { MaterialCatalogSheet } from "@/components/materiales/material-catalog-sheet"
import { MaterialFormSheet } from "@/components/materiales/material-form-sheet"
import { MaterialMovementSheet } from "@/components/materiales/material-movement-sheet"
import { MaterialsFiltersBar } from "@/components/materiales/materials-filters"
import { MaterialsSummaryCards } from "@/components/materiales/materials-summary-cards"
import { MaterialsTable } from "@/components/materiales/materials-table"
import { WarehouseAdminSheet } from "@/components/materiales/warehouse-admin-sheet"
import { buildCatalogDisplayRows } from "@/lib/materials/catalog-display"
import {
  defaultMaterialFilters,
  filterInventoryRows,
  getWarehouseOptionsFromInventory,
} from "@/lib/materials/filters"
import { mergeWarehouseFilterOptions } from "@/lib/materials/warehouse-selection"
import { inventoryRowToCatalog } from "@/lib/supabase/materials.mapper"
import type {
  MaterialCatalogDisplayRow,
  MaterialCatalogItem,
  MaterialFilters,
  MaterialInventoryRow,
  MaterialsSummary,
  WarehouseSelectionContext,
} from "@/lib/types/materials"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function MaterialsModule() {
  const [filters, setFilters] = useState<MaterialFilters>(defaultMaterialFilters)
  const [inventory, setInventory] = useState<MaterialInventoryRow[]>([])
  const [catalog, setCatalog] = useState<MaterialCatalogItem[]>([])
  const [materialIdsWithMovements, setMaterialIdsWithMovements] = useState<
    string[]
  >([])
  const [summary, setSummary] = useState<MaterialsSummary | null>(null)
  const [warehouseContext, setWarehouseContext] =
    useState<WarehouseSelectionContext | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [materialFormOpen, setMaterialFormOpen] = useState(false)
  const [entryOpen, setEntryOpen] = useState(false)
  const [editMaterial, setEditMaterial] = useState<{
    catalog: MaterialCatalogItem
    stockQuantity: number
    hasInventoryHistory: boolean
  } | null>(null)
  const [pendingDelete, setPendingDelete] =
    useState<MaterialCatalogDisplayRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [warehouseAdminOpen, setWarehouseAdminOpen] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [contextResponse, catalogResponse] = await Promise.all([
        fetch("/api/materiales/context", { cache: "no-store" }),
        fetch("/api/materiales/catalog", { cache: "no-store" }),
      ])
      const body = (await contextResponse.json()) as {
        success: boolean
        inventory?: MaterialInventoryRow[]
        summary?: MaterialsSummary
        warehouseContext?: WarehouseSelectionContext
        materialIdsWithMovements?: string[]
        message?: string
      }
      const catalogBody = (await catalogResponse.json()) as {
        success: boolean
        catalog?: MaterialCatalogItem[]
      }

      if (!contextResponse.ok || !body.success) {
        setError(body.message ?? "No se pudo cargar materiales.")
        return
      }

      setInventory(body.inventory ?? [])
      setSummary(body.summary ?? null)
      setWarehouseContext(body.warehouseContext ?? null)
      setMaterialIdsWithMovements(body.materialIdsWithMovements ?? [])
      if (catalogBody.success) {
        setCatalog(catalogBody.catalog ?? [])
      }
    } catch {
      setError("Error de conexión al cargar materiales.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!successMessage) return
    const timer = window.setTimeout(() => setSuccessMessage(null), 5000)
    return () => window.clearTimeout(timer)
  }, [successMessage])

  const movementMaterialIds = useMemo(
    () => new Set(materialIdsWithMovements),
    [materialIdsWithMovements]
  )

  const catalogRows = useMemo(
    () =>
      buildCatalogDisplayRows(catalog, inventory, movementMaterialIds),
    [catalog, inventory, movementMaterialIds]
  )

  const warehouses = useMemo(
    () =>
      mergeWarehouseFilterOptions(
        getWarehouseOptionsFromInventory(inventory),
        warehouseContext
      ),
    [inventory, warehouseContext]
  )

  const filteredInventory = useMemo(
    () => filterInventoryRows(inventory, filters),
    [inventory, filters]
  )

  function openWarehouseAdmin() {
    setMaterialFormOpen(false)
    setCatalogOpen(false)
    setWarehouseAdminOpen(true)
  }

  function openCreateMaterial() {
    setCatalogOpen(false)
    setMaterialFormOpen(true)
  }

  function handleEditCatalogRow(row: MaterialCatalogDisplayRow) {
    setCatalogOpen(false)
    setEditMaterial({
      catalog: row,
      stockQuantity: row.totalStock ?? 0,
      hasInventoryHistory: row.hasInventoryHistory,
    })
  }

  function handleEditInventoryRow(row: MaterialInventoryRow) {
    const companyId = warehouseContext?.warehouses[0]?.companyId ?? ""
    const catalogRow = catalogRows.find((item) => item.id === row.materialId)
    setEditMaterial({
      catalog: inventoryRowToCatalog(row, companyId),
      stockQuantity:
        catalogRow?.totalStock ??
        inventory
          .filter((item) => item.materialId === row.materialId)
          .reduce((sum, item) => sum + item.quantityAvailable, 0),
      hasInventoryHistory: catalogRow?.hasInventoryHistory ?? true,
    })
  }

  function handleDeleteCatalogRow(row: MaterialCatalogDisplayRow) {
    setDeleteError(null)
    setPendingDelete(row)
  }

  async function confirmDelete() {
    if (!pendingDelete) return

    setIsDeleting(true)
    setDeleteError(null)
    try {
      const response = await fetch(
        `/api/materiales/materials/${pendingDelete.id}`,
        { method: "DELETE" }
      )
      const body = (await response.json()) as {
        success: boolean
        message?: string
      }

      if (!response.ok || !body.success) {
        setDeleteError(
          body.message ?? "No se pudo eliminar el material del catálogo."
        )
        return
      }

      setPendingDelete(null)
      setSuccessMessage(
        body.message ?? "Material eliminado del catálogo."
      )
      await loadData()
    } catch {
      setDeleteError("Error de conexión al eliminar el material.")
    } finally {
      setIsDeleting(false)
    }
  }

  const deleteHasInventoryWarning = pendingDelete?.hasInventoryHistory ?? false

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setCatalogOpen(true)}
            className="gap-1.5"
          >
            <Package className="size-4" />
            Catálogo
          </Button>
          <Button
            variant="outline"
            onClick={() => setEntryOpen(true)}
            className="gap-1.5"
          >
            <ArrowDownToLine className="size-4" />
            Registrar entrada
          </Button>
          <Button
            variant="outline"
            onClick={() => setWarehouseAdminOpen(true)}
            className="gap-1.5"
          >
            <Warehouse className="size-4" />
            Depósitos
          </Button>
        </div>
      </div>

      <MaterialsSummaryCards
        summary={summary}
        isLoading={isLoading}
        onOpenCatalog={() => setCatalogOpen(true)}
      />

      <Card className="shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-base">Inventario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {error ? (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          ) : null}
          {successMessage ? (
            <p
              className="text-sm text-emerald-700 dark:text-emerald-400"
              role="status"
            >
              {successMessage}
            </p>
          ) : null}

          <MaterialsFiltersBar
            filters={filters}
            onChange={setFilters}
            resultCount={filteredInventory.length}
            warehouses={warehouses}
          />

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando inventario...</p>
          ) : (
            <MaterialsTable
              rows={filteredInventory}
              onEdit={handleEditInventoryRow}
            />
          )}
        </CardContent>
      </Card>

      <MaterialCatalogSheet
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        rows={catalogRows}
        onCreateMaterial={openCreateMaterial}
        onEdit={handleEditCatalogRow}
        onDelete={handleDeleteCatalogRow}
      />

      <MaterialFormSheet
        open={materialFormOpen}
        onOpenChange={setMaterialFormOpen}
        activeCatalog={catalog}
        warehouseContext={warehouseContext}
        onSaved={loadData}
        onOpenWarehouseAdmin={openWarehouseAdmin}
      />

      <MaterialFormSheet
        open={editMaterial !== null}
        onOpenChange={(open) => {
          if (!open) setEditMaterial(null)
        }}
        material={editMaterial?.catalog ?? null}
        activeCatalog={catalog}
        warehouseContext={warehouseContext}
        stockQuantity={editMaterial?.stockQuantity ?? 0}
        hasInventoryHistory={editMaterial?.hasInventoryHistory ?? false}
        onSaved={() => {
          setEditMaterial(null)
          loadData()
        }}
      />

      <MaterialMovementSheet
        open={entryOpen}
        onOpenChange={setEntryOpen}
        mode="entry"
        warehouseContext={warehouseContext}
        inventory={inventory}
        catalog={catalog}
        onRecorded={loadData}
      />

      <WarehouseAdminSheet
        open={warehouseAdminOpen}
        onOpenChange={setWarehouseAdminOpen}
        onChanged={loadData}
      />

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setPendingDelete(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar material del catálogo</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  El material{" "}
                  <span className="font-medium text-foreground">
                    {pendingDelete?.name}
                  </span>
                  ({pendingDelete?.code}) dejará de aparecer en el catálogo activo
                  y no podrá usarse en nuevos movimientos.
                </p>
                {deleteHasInventoryWarning ? (
                  <p className="text-amber-700">
                    Este material tiene inventario o movimientos registrados. El
                    historial se conservará, pero no podrá seleccionarse para nuevas
                    entradas.
                  </p>
                ) : null}
                <p>
                  Los movimientos históricos se conservan. Esta acción no borra el
                  registro físicamente.
                </p>
                <p>¿Desea continuar?</p>
              </div>
            </DialogDescription>
          </DialogHeader>

          {deleteError ? (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => {
                setPendingDelete(null)
                setDeleteError(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => void confirmDelete()}
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
