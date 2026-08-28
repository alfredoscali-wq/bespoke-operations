"use client"

import Link from "next/link"
import { Eye, Pencil, Trash2 } from "lucide-react"

import {
  MaterialCategoryBadge,
  MaterialStatusBadge,
} from "@/components/materiales/material-badges"
import { formatCatalogTotalStock } from "@/lib/materials/catalog-display"
import { MATERIAL_ITEM_TYPE_LABELS } from "@/lib/materials/constants"
import { formatUnitLabel } from "@/lib/materials/units"
import type { MaterialCatalogDisplayRow } from "@/lib/types/materials"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type MaterialCatalogTableProps = {
  rows: MaterialCatalogDisplayRow[]
  onEdit?: (row: MaterialCatalogDisplayRow) => void
  onDelete?: (row: MaterialCatalogDisplayRow) => void
}

function buildDetailHref(materialId: string) {
  return `/materiales/${materialId}`
}

export function MaterialCatalogTable({
  rows,
  onEdit,
  onDelete,
}: MaterialCatalogTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          No hay materiales en el catálogo
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cree un material para comenzar.
        </p>
      </div>
    )
  }

  const showActions = onEdit || onDelete

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Código</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Fabricante</TableHead>
              <TableHead>Stock total</TableHead>
              <TableHead>Estado</TableHead>
              {showActions ? (
                <TableHead className="w-[220px]">Acciones</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-sm">{row.code}</TableCell>
                <TableCell>
                  <p className="font-medium">{row.name}</p>
                </TableCell>
                <TableCell>
                  <MaterialCategoryBadge category={row.category} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {MATERIAL_ITEM_TYPE_LABELS[row.itemType]}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatUnitLabel(row.unit)}
                </TableCell>
                <TableCell className="max-w-[140px] truncate text-sm text-muted-foreground">
                  {row.manufacturer || "—"}
                </TableCell>
                <TableCell className="text-sm">
                  {formatCatalogTotalStock(row.totalStock, row.unit)}
                </TableCell>
                <TableCell>
                  <MaterialStatusBadge status={row.inventoryStatus} />
                </TableCell>
                {showActions ? (
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        asChild
                      >
                        <Link href={buildDetailHref(row.id)}>
                          <Eye className="size-3.5" />
                          Ver
                        </Link>
                      </Button>
                      {onEdit ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => onEdit(row)}
                        >
                          <Pencil className="size-3.5" />
                          Editar
                        </Button>
                      ) : null}
                      {onDelete ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-destructive hover:text-destructive"
                          onClick={() => onDelete(row)}
                        >
                          <Trash2 className="size-3.5" />
                          Eliminar
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
