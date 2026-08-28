"use client"

import { Plus } from "lucide-react"

import { MaterialCatalogTable } from "@/components/materiales/material-catalog-table"
import { MaterialsSheetShell } from "@/components/materiales/materials-sheet-shell"
import type { MaterialCatalogDisplayRow } from "@/lib/types/materials"
import { Button } from "@/components/ui/button"

type MaterialCatalogSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: MaterialCatalogDisplayRow[]
  onCreateMaterial: () => void
  onEdit?: (row: MaterialCatalogDisplayRow) => void
  onDelete?: (row: MaterialCatalogDisplayRow) => void
}

export function MaterialCatalogSheet({
  open,
  onOpenChange,
  rows,
  onCreateMaterial,
  onEdit,
  onDelete,
}: MaterialCatalogSheetProps) {
  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
        Cerrar
      </Button>
      <Button type="button" className="gap-1.5" onClick={onCreateMaterial}>
        <Plus className="size-4" />
        Nuevo material
      </Button>
    </div>
  )

  return (
    <MaterialsSheetShell
      open={open}
      onOpenChange={onOpenChange}
      title="Catálogo"
      description="Materiales y equipos definidos para la empresa. El stock físico se gestiona en Inventario."
      footer={footer}
    >
      <MaterialCatalogTable rows={rows} onEdit={onEdit} onDelete={onDelete} />
    </MaterialsSheetShell>
  )
}
