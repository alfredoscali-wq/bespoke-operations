"use client"

import { useEffect, useMemo, useState } from "react"

import { MaterialCatalogPicker } from "@/components/materiales/material-catalog-picker"
import { MaterialsSheetShell } from "@/components/materiales/materials-sheet-shell"
import {
  catalogItemsToOptions,
  getInventoryStockForWarehouse,
  type MaterialCatalogOption,
} from "@/lib/materials/catalog"
import { resolveWarehousePickerMode } from "@/lib/materials/warehouse-selection"
import {
  formatUnitLabel,
  isIntegerOnlyUnit,
} from "@/lib/materials/units"
import type {
  MaterialCatalogItem,
  MaterialInventoryRow,
  Warehouse,
  WarehouseSelectionContext,
} from "@/lib/types/materials"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type MovementMode = "entry" | "exit"

type MaterialMovementSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: MovementMode
  warehouseContext?: WarehouseSelectionContext | null
  inventory?: MaterialInventoryRow[]
  catalog?: MaterialCatalogItem[]
  materialId?: string
  materialName?: string
  unit?: string
  defaultWarehouseId?: string | null
  lockMaterial?: boolean
  onRecorded: () => void
}

export function MaterialMovementSheet({
  open,
  onOpenChange,
  mode,
  warehouseContext,
  inventory = [],
  catalog = [],
  materialId: initialMaterialId,
  materialName: initialMaterialName,
  unit: initialUnit,
  defaultWarehouseId,
  lockMaterial = false,
  onRecorded,
}: MaterialMovementSheetProps) {
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(
    null
  )
  const [warehouseId, setWarehouseId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const warehouses = warehouseContext?.warehouses ?? []
  const warehouseMode = resolveWarehousePickerMode(warehouses)
  const formId = `material-movement-${mode}`

  const catalogOptions = useMemo<MaterialCatalogOption[]>(() => {
    if (catalog.length > 0) {
      return catalogItemsToOptions(catalog)
    }
    return catalogItemsToOptions(
      inventory.map((row) => ({
        id: row.materialId,
        companyId: "",
        code: row.code,
        name: row.name,
        category: row.category,
        itemType: row.itemType,
        unit: row.unit,
        minStock: row.minStock,
        manufacturer: row.manufacturer,
        description: row.description,
        active: row.active,
        createdAt: "",
        updatedAt: "",
      }))
    )
  }, [catalog, inventory])

  const selectedMaterial =
    catalogOptions.find((item) => item.id === selectedMaterialId) ?? null

  const unit = selectedMaterial?.unit ?? initialUnit ?? "un"
  const unitLabel = formatUnitLabel(unit)
  const integerOnly = isIntegerOnlyUnit(unit)

  const effectiveWarehouseId =
    warehouseMode === "auto" && warehouses[0]
      ? warehouses[0].id
      : warehouseId

  const currentStock =
    selectedMaterialId && effectiveWarehouseId
      ? getInventoryStockForWarehouse(
          inventory,
          selectedMaterialId,
          effectiveWarehouseId
        )
      : 0

  const parsedQuantity = Number.parseFloat(quantity.replace(",", "."))
  const projectedStock =
    mode === "entry" && Number.isFinite(parsedQuantity)
      ? currentStock + parsedQuantity
      : mode === "exit" && Number.isFinite(parsedQuantity)
        ? currentStock - parsedQuantity
        : null

  const lockedLabel =
    lockMaterial && (selectedMaterial || initialMaterialName)
      ? `${selectedMaterial?.code ?? ""} — ${selectedMaterial?.name ?? initialMaterialName}`
      : null

  useEffect(() => {
    if (!open) return
    setError(null)
    setQuantity("")
    setNotes("")
    setSelectedMaterialId(initialMaterialId ?? null)
    if (warehouseMode === "auto" && warehouses[0]) {
      setWarehouseId(warehouses[0].id)
      return
    }
    const initial =
      defaultWarehouseId ??
      warehouseContext?.defaultWarehouseId ??
      warehouses[0]?.id ??
      ""
    setWarehouseId(initial)
  }, [
    open,
    initialMaterialId,
    defaultWarehouseId,
    warehouseContext,
    warehouses,
    warehouseMode,
  ])

  function resolveWarehouseIdForSubmit(): string {
    if (warehouseMode === "auto" && warehouses[0]) {
      return warehouses[0].id
    }
    return warehouseId
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const materialId = selectedMaterialId
    if (!materialId) {
      setError("Seleccione un material del catálogo.")
      return
    }

    const effectiveWarehouseId = resolveWarehouseIdForSubmit()
    if (!effectiveWarehouseId) {
      setError("Seleccione un depósito.")
      return
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError("La cantidad debe ser mayor a cero.")
      return
    }
    if (integerOnly && !Number.isInteger(parsedQuantity)) {
      setError("Para piezas la cantidad debe ser un número entero.")
      return
    }
    if (mode === "exit" && parsedQuantity > currentStock) {
      setError("Stock disponible insuficiente para la salida.")
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch("/api/materiales/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId,
          warehouseId: effectiveWarehouseId,
          quantity: parsedQuantity,
          notes: notes.trim(),
          movementType: mode === "entry" ? "entry" : "exit",
        }),
      })
      const body = (await response.json()) as {
        success: boolean
        message?: string
      }

      if (!response.ok || !body.success) {
        setError(body.message ?? "No se pudo registrar el movimiento.")
        return
      }

      onRecorded()
      onOpenChange(false)
    } catch {
      setError("Error de conexión al registrar el movimiento.")
    } finally {
      setIsSaving(false)
    }
  }

  const title = mode === "entry" ? "Registrar entrada" : "Registrar salida"
  const description =
    mode === "entry"
      ? "Cargar stock de un material existente en el catálogo."
      : "Registrar salida de stock."

  const warehouseField =
    warehouseMode === "none" ? (
      <p className="text-sm text-muted-foreground">
        Cree un depósito antes de registrar movimientos.
      </p>
    ) : warehouseMode === "auto" && warehouses[0] ? (
      <div className="space-y-2">
        <Label>Depósito</Label>
        <Select value={warehouses[0].id} disabled>
          <SelectTrigger className="bg-muted/40">
            <SelectValue>{warehouses[0].name}</SelectValue>
          </SelectTrigger>
        </Select>
        <p className="text-xs text-muted-foreground">
          Se utilizará el único depósito activo de la empresa.
        </p>
      </div>
    ) : (
      <div className="space-y-2">
        <Label>Depósito</Label>
        <Select value={warehouseId} onValueChange={setWarehouseId}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar depósito" />
          </SelectTrigger>
          <SelectContent>
            {warehouses.map((warehouse: Warehouse) => (
              <SelectItem key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )

  return (
    <MaterialsSheetShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={
              isSaving ||
              warehouseMode === "none" ||
              (!lockMaterial && catalogOptions.length === 0)
            }
          >
            {isSaving ? "Guardando..." : "Registrar"}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <MaterialCatalogPicker
          options={catalogOptions}
          value={selectedMaterialId}
          onChange={setSelectedMaterialId}
          disabled={lockMaterial}
          lockedLabel={lockedLabel}
        />

        {warehouseField}

        {selectedMaterialId ? (
          <div className="rounded-lg border bg-muted/20 p-3 text-sm space-y-1">
            <p className="text-muted-foreground">Stock actual en depósito</p>
            <p className="font-medium tabular-nums">
              {currentStock.toLocaleString("es-MX")} {unitLabel}
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="movement-quantity">
            {mode === "entry" ? "Entrada" : "Cantidad"}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="movement-quantity"
              type="number"
              min={0}
              step={integerOnly ? "1" : "any"}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground shrink-0">
              {unitLabel}
            </span>
          </div>
        </div>

        {mode === "entry" &&
        projectedStock !== null &&
        Number.isFinite(parsedQuantity) ? (
          <div className="rounded-lg border p-3 text-sm">
            <p className="text-muted-foreground">Stock resultante</p>
            <p className="font-medium tabular-nums">
              {projectedStock.toLocaleString("es-MX")} {unitLabel}
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="movement-notes">Observaciones</Label>
          <Textarea
            id="movement-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        ) : null}
      </form>
    </MaterialsSheetShell>
  )
}
