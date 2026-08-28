"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowLeft, Pencil } from "lucide-react"

import { MaterialFormSheet } from "@/components/materiales/material-form-sheet"
import { MaterialMovementSheet } from "@/components/materiales/material-movement-sheet"
import { MaterialPhotoThumb } from "@/components/materiales/material-photo-thumb"
import { MaterialStockAdjustmentSheet } from "@/components/materiales/material-stock-adjustment-sheet"
import { MaterialDetailStats } from "@/components/materiales/material-detail-stats"
import {
  MaterialCategoryBadge,
  MaterialStatusBadge,
} from "@/components/materiales/material-badges"
import { MaterialAssignmentsTab } from "@/components/materiales/material-tabs/assignments-tab"
import { MaterialHistoryTab } from "@/components/materiales/material-tabs/history-tab"
import { MaterialMovementsTab } from "@/components/materiales/material-tabs/movements-tab"
import { MaterialOverviewTab } from "@/components/materiales/material-tabs/overview-tab"
import type {
  Material,
  MaterialCatalogItem,
  MaterialDetail,
  MaterialInventoryRow,
  WarehouseSelectionContext,
} from "@/lib/types/materials"
import { formatUnitLabel } from "@/lib/materials/units"
import { MATERIAL_ITEM_TYPE_LABELS } from "@/lib/materials/constants"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type MaterialDetailViewProps = {
  material: Material
  catalog: MaterialCatalogItem
  detail: MaterialDetail
  stockLevels: MaterialInventoryRow[]
  warehouseId: string | null
  warehouseContext: WarehouseSelectionContext | null
  onRefresh: () => void
}

export function MaterialDetailView({
  material,
  catalog,
  detail,
  stockLevels,
  warehouseId,
  warehouseContext,
  onRefresh,
}: MaterialDetailViewProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [entryOpen, setEntryOpen] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)

  const totalStock = stockLevels.reduce(
    (sum, level) => sum + level.quantityAvailable,
    0
  )
  const hasInventoryHistory =
    stockLevels.length > 0 || detail.stats.totalMovements > 0
  const displayStatus = hasInventoryHistory
    ? material.status
    : "no-inventory"
  const currentWarehouseStock =
    stockLevels.find((level) => level.warehouseId === warehouseId) ??
    stockLevels[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <MaterialPhotoThumb
            photoAttachmentId={catalog.photoAttachmentId}
            alt={material.name}
            size="lg"
          />
          <div className="space-y-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 h-8 gap-1.5 text-muted-foreground"
              asChild
            >
              <Link href="/materiales">
                <ArrowLeft className="size-4" />
                Volver a materiales
              </Link>
            </Button>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <MaterialCategoryBadge category={material.category} />
                <MaterialStatusBadge status={displayStatus} />
                <span className="rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                  {material.code}
                </span>
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {material.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {material.manufacturer || "Sin fabricante"} ·{" "}
                {MATERIAL_ITEM_TYPE_LABELS[catalog.itemType]} ·{" "}
                {material.warehouse}
              </p>
              {catalog.description ? (
                <p className="text-sm text-muted-foreground">{catalog.description}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 self-start">
          <Button size="sm" onClick={() => setEntryOpen(true)}>
            Registrar entrada
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExitOpen(true)}
            disabled={!hasInventoryHistory}
          >
            Registrar salida
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdjustOpen(true)}
            disabled={!hasInventoryHistory}
          >
            Ajustar stock
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-4" />
            Editar material
          </Button>
        </div>
      </div>

      {stockLevels.length > 1 ? (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Stock por depósito
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {stockLevels.map((level) => (
              <Link
                key={level.stockLevelId}
                href={`/materiales/${level.materialId}?warehouse=${level.warehouseId}`}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/40 ${
                  level.warehouseId === warehouseId ? "border-primary bg-primary/5" : ""
                }`}
              >
                <span className="font-medium">{level.warehouse}</span>
                <span className="ml-2 tabular-nums text-muted-foreground">
                  {level.quantityAvailable.toLocaleString("es-MX")}{" "}
                  {formatUnitLabel(level.unit)}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Información del material</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Stock físico</p>
            <p className="text-sm font-medium tabular-nums">
              {hasInventoryHistory
                ? `${(
                    material.stock ??
                    currentWarehouseStock?.quantityAvailable ??
                    0
                  ).toLocaleString("es-MX")} ${formatUnitLabel(material.unit)}`
                : "Sin stock registrado"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Reservado</p>
            <p className="text-sm font-medium tabular-nums">
              {hasInventoryHistory
                ? `${(
                    currentWarehouseStock?.quantityReserved ??
                    material.quantityReserved ??
                    0
                  ).toLocaleString("es-MX")} ${formatUnitLabel(material.unit)}`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Disponible</p>
            <p className="text-sm font-medium tabular-nums">
              {hasInventoryHistory
                ? `${(
                    currentWarehouseStock?.netAvailable ??
                    material.netAvailable ??
                    0
                  ).toLocaleString("es-MX")} ${formatUnitLabel(material.unit)}`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Stock mínimo</p>
            <p className="text-sm font-medium tabular-nums">
              {material.minStock.toLocaleString("es-MX")}{" "}
              {formatUnitLabel(material.unit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Estado</p>
            <div className="mt-1">
              <MaterialStatusBadge status={displayStatus} />
            </div>
          </div>
        </CardContent>
      </Card>

      <MaterialDetailStats material={material} stats={detail.stats} />

      <Separator />

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList variant="line" className="w-full min-w-max justify-start">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="movements">
              Movimientos ({detail.movements.length})
            </TabsTrigger>
            <TabsTrigger value="assignments">
              Reservas activas ({detail.activeReservations.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              Historial ({detail.history.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <MaterialOverviewTab material={material} />
        </TabsContent>
        <TabsContent value="movements">
          <MaterialMovementsTab movements={detail.movements} />
        </TabsContent>
        <TabsContent value="assignments">
          <MaterialAssignmentsTab
            activeReservations={detail.activeReservations}
          />
        </TabsContent>
        <TabsContent value="history">
          <MaterialHistoryTab history={detail.history} />
        </TabsContent>
      </Tabs>

      <MaterialFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        material={catalog}
        activeCatalog={[catalog]}
        warehouseContext={warehouseContext}
        stockQuantity={totalStock}
        hasInventoryHistory={hasInventoryHistory}
        onSaved={onRefresh}
      />

      <MaterialMovementSheet
        open={entryOpen}
        onOpenChange={setEntryOpen}
        materialId={material.materialId ?? material.id}
        materialName={material.name}
        unit={material.unit}
        defaultWarehouseId={warehouseId}
        warehouseContext={warehouseContext}
        inventory={stockLevels}
        catalog={[catalog]}
        mode="entry"
        lockMaterial
        onRecorded={onRefresh}
      />

      <MaterialMovementSheet
        open={exitOpen}
        onOpenChange={setExitOpen}
        materialId={material.materialId ?? material.id}
        materialName={material.name}
        unit={material.unit}
        defaultWarehouseId={warehouseId}
        warehouseContext={warehouseContext}
        inventory={stockLevels}
        catalog={[catalog]}
        mode="exit"
        lockMaterial
        onRecorded={onRefresh}
      />

      <MaterialStockAdjustmentSheet
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        materialId={material.materialId ?? material.id}
        materialName={material.name}
        unit={material.unit}
        currentStock={
          currentWarehouseStock?.quantityAvailable ??
          material.stock ??
          0
        }
        defaultWarehouseId={warehouseId}
        warehouseContext={warehouseContext}
        onRecorded={onRefresh}
      />
    </div>
  )
}
