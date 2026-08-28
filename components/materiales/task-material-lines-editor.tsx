"use client"

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react"
import { Plus, Trash2 } from "lucide-react"

import { MaterialCatalogPicker } from "@/components/materiales/material-catalog-picker"
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
import {
  catalogItemsToOptions,
  type MaterialCatalogOption,
} from "@/lib/materials/catalog"
import {
  buildDraftLineKey,
  fetchTaskMaterialLinesClient,
  syncTaskMaterialLinesClient,
  type TaskMaterialLineEditorRow,
} from "@/lib/materials/task-material-lines.client"
import {
  buildInsufficientStockWarning,
  validateTaskMaterialLineQuantity,
} from "@/lib/materials/task-material-lines.validation"
import { computeNetAvailable } from "@/lib/materials/stock-status"
import { formatUnitLabel } from "@/lib/materials/units"
import { getTaskMaterialLineReservationDisplay } from "@/lib/materials/reservation-status"
import { resolveWarehousePickerMode } from "@/lib/materials/warehouse-selection"
import type {
  MaterialCatalogItem,
  MaterialInventoryRow,
  TaskMaterialLineDraft,
  TaskMaterialLineView,
  WarehouseSelectionContext,
} from "@/lib/types/materials"

export type TaskMaterialLinesEditorHandle = {
  sync: (taskId: string) => Promise<void>
  validate: () => { valid: boolean; message?: string }
  getRows: () => TaskMaterialLineEditorRow[]
  getDraftLines: () => TaskMaterialLineDraft[]
}

type TaskMaterialLinesEditorProps = {
  taskId?: string | null
  catalog: MaterialCatalogItem[]
  inventory: MaterialInventoryRow[]
  warehouseContext: WarehouseSelectionContext | null
  disabled?: boolean
  onRowsChange?: (rows: TaskMaterialLineEditorRow[]) => void
}

function resolveInventoryBreakdown(
  inventory: MaterialInventoryRow[],
  materialId: string,
  warehouseId: string
) {
  const row = inventory.find(
    (item) =>
      item.materialId === materialId && item.warehouseId === warehouseId
  )
  if (!row) {
    return {
      quantityAvailable: 0,
      quantityReserved: 0,
      netAvailable: 0,
    }
  }
  return {
    quantityAvailable: row.quantityAvailable,
    quantityReserved: row.quantityReserved ?? 0,
    netAvailable:
      row.netAvailable ??
      computeNetAvailable(row.quantityAvailable, row.quantityReserved ?? 0),
  }
}

export const TaskMaterialLinesEditor = forwardRef<
  TaskMaterialLinesEditorHandle,
  TaskMaterialLinesEditorProps
>(function TaskMaterialLinesEditor(
  {
    taskId,
    catalog,
    inventory,
    warehouseContext,
    disabled = false,
    onRowsChange,
  },
  ref
) {
  const [rows, setRows] = useState<TaskMaterialLineEditorRow[]>([])
  const [loadedTaskId, setLoadedTaskId] = useState<string | null>(null)
  const [existingSnapshot, setExistingSnapshot] = useState<
    TaskMaterialLineView[]
  >([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [draftMaterialId, setDraftMaterialId] = useState<string | null>(null)
  const [draftWarehouseId, setDraftWarehouseId] = useState("")
  const [draftQuantity, setDraftQuantity] = useState("")
  const [draftError, setDraftError] = useState<string | null>(null)

  const catalogOptions = useMemo<MaterialCatalogOption[]>(
    () => catalogItemsToOptions(catalog),
    [catalog]
  )

  const warehouses = warehouseContext?.warehouses ?? []
  const warehouseMode = resolveWarehousePickerMode(warehouses)

  const selectedMaterial = catalog.find((item) => item.id === draftMaterialId)
  const draftUnit = selectedMaterial?.unit ?? "un"
  const draftUnitLabel = formatUnitLabel(draftUnit)

  const effectiveWarehouseId =
    warehouseMode === "auto" && warehouses[0]
      ? warehouses[0].id
      : draftWarehouseId

  const draftStock = draftMaterialId && effectiveWarehouseId
    ? resolveInventoryBreakdown(inventory, draftMaterialId, effectiveWarehouseId)
    : null

  const draftNetStock = draftStock?.netAvailable ?? null

  const parsedDraftQuantity = Number.parseFloat(
    draftQuantity.trim().replace(",", ".")
  )

  const draftStockWarning =
    draftMaterialId &&
    effectiveWarehouseId &&
    Number.isFinite(parsedDraftQuantity) &&
    parsedDraftQuantity > 0
      ? buildInsufficientStockWarning({
          quantityPlanned: parsedDraftQuantity,
          netAvailable: draftNetStock ?? 0,
          unit: draftUnit,
        })
      : null

  function updateRows(next: TaskMaterialLineEditorRow[]) {
    setRows(next)
    onRowsChange?.(next)
  }

  useEffect(() => {
    if (!taskId) {
      setLoadedTaskId(null)
      setExistingSnapshot([])
      return
    }

    if (loadedTaskId === taskId) return

    let cancelled = false
    setIsLoading(true)
    setLoadError(null)

    void fetchTaskMaterialLinesClient(taskId)
      .then((lines) => {
        if (cancelled) return
        const persisted: TaskMaterialLineEditorRow[] = lines.map((line) => ({
          ...line,
          kind: "persisted",
        }))
        setExistingSnapshot(lines)
        setRows(persisted)
        onRowsChange?.(persisted)
        setLoadedTaskId(taskId)
      })
      .catch((error) => {
        if (cancelled) return
        setLoadError(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los materiales."
        )
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [taskId, loadedTaskId, onRowsChange])

  useEffect(() => {
    if (warehouseMode === "auto" && warehouses[0]) {
      setDraftWarehouseId(warehouses[0].id)
    }
  }, [warehouseMode, warehouses])

  function validateRows(currentRows: TaskMaterialLineEditorRow[]): {
    valid: boolean
    message?: string
  } {
    for (const row of currentRows) {
      const materialId = row.materialId
      const material = catalog.find((item) => item.id === materialId)
      if (!material || !material.active) {
        return {
          valid: false,
          message: "Este material no está en el catálogo.",
        }
      }
      const quantityValidation = validateTaskMaterialLineQuantity(
        material.unit,
        row.quantityPlanned
      )
      if (!quantityValidation.ok) {
        return { valid: false, message: quantityValidation.message }
      }
      if (!row.warehouseId) {
        return { valid: false, message: "Seleccione un depósito." }
      }
    }
    return { valid: true }
  }

  useImperativeHandle(ref, () => ({
    sync: async (targetTaskId: string) => {
      const validation = validateRows(rows)
      if (!validation.valid) {
        throw new Error(validation.message ?? "Revise los materiales del catálogo.")
      }
      const synced = await syncTaskMaterialLinesClient({
        taskId: targetTaskId,
        desiredRows: rows,
        existingLines: existingSnapshot,
      })
      const persisted: TaskMaterialLineEditorRow[] = synced.map((line) => ({
        ...line,
        kind: "persisted",
      }))
      setExistingSnapshot(synced)
      setRows(persisted)
      setLoadedTaskId(targetTaskId)
      onRowsChange?.(persisted)
    },
    validate: () => validateRows(rows),
    getRows: () => rows,
    getDraftLines: () =>
      rows
        .filter((row): row is TaskMaterialLineDraft & { kind: "draft" } =>
          row.kind === "draft"
        )
        .map(({ kind: _kind, ...draft }) => draft),
  }))

  function handleAddLine() {
    setDraftError(null)

    if (!draftMaterialId) {
      setDraftError("Seleccione un material del catálogo.")
      return
    }

    const material = catalog.find((item) => item.id === draftMaterialId)
    if (!material || !material.active) {
      setDraftError("Este material no está en el catálogo.")
      return
    }

    const warehouseId = effectiveWarehouseId
    if (!warehouseId) {
      setDraftError("Seleccione un depósito.")
      return
    }

    const quantityValidation = validateTaskMaterialLineQuantity(
      material.unit,
      draftQuantity
    )
    if (!quantityValidation.ok) {
      setDraftError(quantityValidation.message)
      return
    }

    const draft: TaskMaterialLineEditorRow = {
      kind: "draft",
      clientKey: buildDraftLineKey(),
      materialId: material.id,
      warehouseId,
      quantityPlanned: quantityValidation.quantity,
      unit: material.unit,
      notes: null,
    }

    updateRows([...rows, draft])
    setDraftMaterialId(null)
    setDraftQuantity("")
    setDraftError(null)
  }

  function handleRemoveRow(index: number) {
    updateRows(rows.filter((_, rowIndex) => rowIndex !== index))
  }

  function resolveRowDisplay(row: TaskMaterialLineEditorRow) {
    const material =
      row.kind === "persisted"
        ? { code: row.materialCode, name: row.materialName, unit: row.unit }
        : catalog.find((item) => item.id === row.materialId)

    const warehouseName =
      row.kind === "persisted"
        ? row.warehouseName
        : warehouses.find((entry) => entry.id === row.warehouseId)?.name ?? "—"

    const stock = resolveInventoryBreakdown(
      inventory,
      row.materialId,
      row.warehouseId
    )

    return {
      code: material && "code" in material ? material.code : "—",
      name: material && "name" in material ? material.name : "—",
      unit: material && "unit" in material ? material.unit : row.unit,
      warehouseName,
      netAvailable:
        row.kind === "persisted" ? row.netAvailable : stock.netAvailable,
      quantityAvailable:
        row.kind === "persisted"
          ? row.quantityAvailable
          : stock.quantityAvailable,
      quantityReserved:
        row.kind === "persisted"
          ? row.quantityReserved
          : stock.quantityReserved,
    }
  }

  const warehouseField =
    warehouseMode === "none" ? (
      <p className="text-sm text-muted-foreground">
        No hay depósitos activos. Creá un depósito antes de asignar materiales.
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
        <Select
          value={draftWarehouseId || undefined}
          onValueChange={setDraftWarehouseId}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar depósito" />
          </SelectTrigger>
          <SelectContent>
            {warehouses.map((warehouse) => (
              <SelectItem key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )

  return (
    <section className="space-y-4 rounded-xl border bg-muted/10 p-4">
      <div>
        <h4 className="text-sm font-semibold text-foreground">
          Materiales del catálogo
        </h4>
        <p className="text-xs text-muted-foreground">
          Información de stock informativa en planificación. La reserva se
          genera al confirmar o asignar la OT.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando materiales…</p>
      ) : null}

      {loadError ? (
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map((row, index) => {
            const display = resolveRowDisplay(row)
            const warning = buildInsufficientStockWarning({
              quantityPlanned: row.quantityPlanned,
              netAvailable: display.netAvailable ?? 0,
              unit: display.unit,
            })
            return (
              <li
                key={row.kind === "persisted" ? row.id : row.clientKey}
                className="rounded-lg border bg-background p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="font-mono text-xs text-primary">
                      {display.code}
                    </p>
                    <p className="font-medium">{display.name}</p>
                    <p className="text-muted-foreground">
                      {row.quantityPlanned.toLocaleString("es-AR")}{" "}
                      {formatUnitLabel(display.unit)} · {display.warehouseName}
                    </p>
                    <div className="text-xs text-muted-foreground">
                      <p>
                        Físico:{" "}
                        {(display.quantityAvailable ?? 0).toLocaleString("es-AR")}{" "}
                        {formatUnitLabel(display.unit)}
                      </p>
                      <p>
                        Reservado:{" "}
                        {(display.quantityReserved ?? 0).toLocaleString("es-AR")}{" "}
                        {formatUnitLabel(display.unit)}
                      </p>
                      <p>
                        Disponible:{" "}
                        {(display.netAvailable ?? 0).toLocaleString("es-AR")}{" "}
                        {formatUnitLabel(display.unit)}
                      </p>
                    </div>
                    {warning ? (
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                        {warning}
                      </p>
                    ) : null}
                    {row.kind === "persisted" ? (
                      <p className="text-xs text-muted-foreground">
                        Estado:{" "}
                        {getTaskMaterialLineReservationDisplay(row.status).label}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Estado: Pendiente de reserva
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive"
                    disabled={disabled}
                    onClick={() => handleRemoveRow(index)}
                    aria-label="Eliminar material"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No hay materiales del catálogo en esta OT.
        </p>
      )}

      <div className="space-y-3 rounded-lg border border-dashed p-3">
        {catalogOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Este material no está en el catálogo. Agregá materiales desde el
            módulo Materiales.
          </p>
        ) : (
          <>
            <MaterialCatalogPicker
              options={catalogOptions}
              value={draftMaterialId}
              onChange={setDraftMaterialId}
              disabled={disabled || warehouseMode === "none"}
            />

            {warehouseField}

            {draftMaterialId && effectiveWarehouseId && draftStock ? (
              <div className="rounded-lg border bg-muted/20 p-3 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Físico: </span>
                  <span className="font-medium tabular-nums">
                    {draftStock.quantityAvailable.toLocaleString("es-AR")} {draftUnitLabel}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Reservado: </span>
                  <span className="font-medium tabular-nums">
                    {draftStock.quantityReserved.toLocaleString("es-AR")} {draftUnitLabel}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Disponible: </span>
                  <span className="font-medium tabular-nums">
                    {(draftNetStock ?? 0).toLocaleString("es-AR")} {draftUnitLabel}
                  </span>
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="task-material-line-quantity">Cantidad</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="task-material-line-quantity"
                  type="number"
                  min={0}
                  step={draftUnit === "m" ? "any" : "1"}
                  value={draftQuantity}
                  onChange={(event) => setDraftQuantity(event.target.value)}
                  disabled={disabled}
                  className="flex-1"
                />
                <span className="shrink-0 text-sm text-muted-foreground">
                  {draftUnitLabel}
                </span>
              </div>
            </div>

            {draftStockWarning ? (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                {draftStockWarning}
              </p>
            ) : null}

            {draftError ? (
              <p className="text-sm text-destructive" role="alert">
                {draftError}
              </p>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={disabled || warehouseMode === "none"}
              onClick={handleAddLine}
            >
              <Plus className="size-4" />
              Agregar material
            </Button>
          </>
        )}
      </div>
    </section>
  )
})

export function useMaterialsContextLoader() {
  const [catalog, setCatalog] = useState<MaterialCatalogItem[]>([])
  const [inventory, setInventory] = useState<MaterialInventoryRow[]>([])
  const [warehouseContext, setWarehouseContext] =
    useState<WarehouseSelectionContext | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    void Promise.all([
      fetch("/api/materiales/context"),
      fetch("/api/materiales/catalog"),
    ])
      .then(async ([contextResponse, catalogResponse]) => {
        if (!contextResponse.ok || !catalogResponse.ok) {
          throw new Error("No se pudo cargar el contexto de materiales.")
        }
        const contextBody = (await contextResponse.json()) as {
          inventory?: MaterialInventoryRow[]
          warehouseContext?: WarehouseSelectionContext
        }
        const catalogBody = (await catalogResponse.json()) as {
          catalog?: MaterialCatalogItem[]
        }
        return { contextBody, catalogBody }
      })
      .then(({ contextBody, catalogBody }) => {
        if (cancelled) return
        setCatalog(catalogBody.catalog ?? [])
        setInventory(contextBody.inventory ?? [])
        setWarehouseContext(contextBody.warehouseContext ?? null)
      })
      .catch((loadError) => {
        if (cancelled) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar materiales."
        )
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { catalog, inventory, warehouseContext, isLoading, error }
}
