"use client"

import { useEffect, useState } from "react"

import { MaterialsSheetShell } from "@/components/materiales/materials-sheet-shell"
import { resolveWarehousePickerMode } from "@/lib/materials/warehouse-selection"
import {
  formatUnitLabel,
  isIntegerOnlyUnit,
} from "@/lib/materials/units"
import type { Warehouse, WarehouseSelectionContext } from "@/lib/types/materials"
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

type MaterialStockAdjustmentSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  materialId: string
  materialName: string
  unit: string
  currentStock: number
  defaultWarehouseId?: string | null
  warehouseContext?: WarehouseSelectionContext | null
  onRecorded: () => void
}

export function MaterialStockAdjustmentSheet({
  open,
  onOpenChange,
  materialId,
  materialName,
  unit,
  currentStock,
  defaultWarehouseId,
  warehouseContext,
  onRecorded,
}: MaterialStockAdjustmentSheetProps) {
  const [warehouseId, setWarehouseId] = useState("")
  const [delta, setDelta] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const warehouses = warehouseContext?.warehouses ?? []
  const warehouseMode = resolveWarehousePickerMode(warehouses)
  const unitLabel = formatUnitLabel(unit)
  const integerOnly = isIntegerOnlyUnit(unit)
  const formId = "material-stock-adjustment"

  const parsedDelta = Number.parseFloat(delta.replace(",", "."))
  const projectedStock =
    Number.isFinite(parsedDelta) ? currentStock + parsedDelta : null

  useEffect(() => {
    if (!open) return
    setError(null)
    setDelta("")
    setReason("")
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
  }, [open, defaultWarehouseId, warehouseContext, warehouses, warehouseMode])

  function resolveWarehouseIdForSubmit(): string {
    if (warehouseMode === "auto" && warehouses[0]) {
      return warehouses[0].id
    }
    return warehouseId
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const effectiveWarehouseId = resolveWarehouseIdForSubmit()
    if (!effectiveWarehouseId) {
      setError("Seleccione un depósito.")
      return
    }

    if (!Number.isFinite(parsedDelta) || parsedDelta === 0) {
      setError("Indique un ajuste distinto de cero.")
      return
    }

    if (integerOnly && !Number.isInteger(parsedDelta)) {
      setError("Para unidades enteras el ajuste debe ser un número entero.")
      return
    }

    if (projectedStock === null || projectedStock < 0) {
      setError("El stock no puede quedar negativo.")
      return
    }

    const notes = [
      `Ajuste: ${parsedDelta}`,
      reason.trim() ? reason.trim() : "",
    ]
      .filter(Boolean)
      .join(" · ")

    setIsSaving(true)
    try {
      const response = await fetch("/api/materiales/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId,
          warehouseId: effectiveWarehouseId,
          movementType: "adjustment",
          newQuantity: projectedStock,
          notes,
        }),
      })
      const body = (await response.json()) as {
        success: boolean
        message?: string
      }

      if (!response.ok || !body.success) {
        setError(body.message ?? "No se pudo registrar el ajuste.")
        return
      }

      onRecorded()
      onOpenChange(false)
    } catch {
      setError("Error de conexión al registrar el ajuste.")
    } finally {
      setIsSaving(false)
    }
  }

  const warehouseField =
    warehouseMode === "none" ? (
      <p className="text-sm text-muted-foreground">
        Cree un depósito antes de ajustar stock.
      </p>
    ) : warehouseMode === "auto" && warehouses[0] ? (
      <div className="space-y-2">
        <Label>Depósito</Label>
        <Select value={warehouses[0].id} disabled>
          <SelectTrigger className="bg-muted/40">
            <SelectValue>{warehouses[0].name}</SelectValue>
          </SelectTrigger>
        </Select>
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
      title="Ajustar stock"
      description={`${materialName} · stock actual: ${currentStock.toLocaleString("es-MX")} ${unitLabel}`}
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
            disabled={isSaving || warehouseMode === "none"}
          >
            {isSaving ? "Guardando..." : "Registrar ajuste"}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        {warehouseField}

        <div className="rounded-lg border bg-muted/20 p-3 text-sm">
          <p className="text-muted-foreground">Stock actual</p>
          <p className="font-medium tabular-nums">
            {currentStock.toLocaleString("es-MX")} {unitLabel}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="adjustment-delta">Ajuste</Label>
          <div className="flex items-center gap-2">
            <Input
              id="adjustment-delta"
              type="number"
              step={integerOnly ? "1" : "any"}
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="Ej: -200 o 50"
              required
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground shrink-0">
              {unitLabel}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Use valores negativos para reducir y positivos para aumentar.
          </p>
        </div>

        {projectedStock !== null && Number.isFinite(parsedDelta) ? (
          <div className="rounded-lg border p-3 text-sm">
            <p className="text-muted-foreground">Nuevo stock</p>
            <p
              className={`font-medium tabular-nums ${
                projectedStock < 0 ? "text-destructive" : ""
              }`}
            >
              {projectedStock.toLocaleString("es-MX")} {unitLabel}
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="adjustment-reason">Motivo</Label>
          <Textarea
            id="adjustment-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Ej: Diferencia de inventario"
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        ) : null}
      </form>
    </MaterialsSheetShell>
  )
}
