"use client"

import Link from "next/link"
import { Pencil } from "lucide-react"

import {
  MaterialCategoryBadge,
  MaterialStatusBadge,
} from "@/components/materiales/material-badges"
import type { MaterialInventoryRow } from "@/lib/types/materials"
import { formatUnitLabel } from "@/lib/materials/units"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type MaterialsTableProps = {
  rows: MaterialInventoryRow[]
  onEdit?: (row: MaterialInventoryRow) => void
}

function buildDetailHref(row: MaterialInventoryRow) {
  const params = new URLSearchParams({ warehouse: row.warehouseId })
  return `/materiales/${row.materialId}?${params.toString()}`
}

export function MaterialsTable({ rows, onEdit }: MaterialsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          No hay materiales en inventario
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Los materiales aparecen aquí cuando se registra una entrada de stock.
        </p>
      </div>
    )
  }

  const showActions = Boolean(onEdit)

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-sm lg:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Código</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Stock disponible</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Depósito</TableHead>
                <TableHead>Estado</TableHead>
                {showActions ? (
                  <TableHead className="w-[120px]">Acciones</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.stockLevelId}>
                  <TableCell>
                    <Link
                      href={buildDetailHref(row)}
                      className="font-mono text-sm font-medium hover:text-primary"
                    >
                      {row.code}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={buildDetailHref(row)}
                      className="font-medium hover:text-primary"
                    >
                      {row.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {row.manufacturer}
                    </p>
                  </TableCell>
                  <TableCell>
                    <MaterialCategoryBadge category={row.category} />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.quantityAvailable.toLocaleString("es-MX")}
                    {row.quantityReserved > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {row.netAvailable.toLocaleString("es-MX")} disponible neto
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatUnitLabel(row.unit)}
                  </TableCell>
                  <TableCell className="max-w-[180px] text-sm text-muted-foreground">
                    {row.warehouse}
                  </TableCell>
                  <TableCell>
                    <MaterialStatusBadge status={row.status} />
                  </TableCell>
                  {showActions ? (
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => onEdit?.(row)}
                      >
                        <Pencil className="size-3.5" />
                        Editar
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {rows.map((row) => (
          <Link key={row.stockLevelId} href={buildDetailHref(row)}>
            <Card className="h-full shadow-sm transition-colors hover:bg-muted/30">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-primary">{row.code}</p>
                    <CardTitle className="text-base">{row.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {row.warehouse}
                    </CardDescription>
                  </div>
                  <MaterialStatusBadge status={row.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <MaterialCategoryBadge category={row.category} />
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="rounded-lg border bg-muted/20 p-2">
                    <p className="font-semibold tabular-nums text-foreground">
                      {row.quantityAvailable.toLocaleString("es-MX")}
                    </p>
                    <p className="text-muted-foreground">
                      Disponible ({formatUnitLabel(row.unit)})
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-2">
                    <p className="font-semibold tabular-nums text-foreground">
                      {row.minStock.toLocaleString("es-MX")}
                    </p>
                    <p className="text-muted-foreground">Mínimo</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
