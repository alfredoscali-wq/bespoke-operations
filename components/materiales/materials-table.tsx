"use client"

import Link from "next/link"

import {
  MaterialCategoryBadge,
  MaterialStatusBadge,
} from "@/components/materiales/material-badges"
import type { Material } from "@/lib/types/materials"
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
  materials: Material[]
}

export function MaterialsTable({ materials }: MaterialsTableProps) {
  if (materials.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          No se encontraron materiales
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajusta los filtros para ver más resultados.
        </p>
      </div>
    )
  }

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
                <TableHead>Stock</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Almacén</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((material) => (
                <TableRow key={material.id}>
                  <TableCell>
                    <Link
                      href={`/materiales/${material.id}`}
                      className="font-mono text-sm font-medium hover:text-primary"
                    >
                      {material.code}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/materiales/${material.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {material.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {material.manufacturer}
                    </p>
                  </TableCell>
                  <TableCell>
                    <MaterialCategoryBadge category={material.category} />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {material.stock.toLocaleString("es-MX")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {material.unit}
                  </TableCell>
                  <TableCell className="max-w-[180px] text-sm text-muted-foreground">
                    {material.warehouse}
                  </TableCell>
                  <TableCell>
                    <MaterialStatusBadge status={material.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {materials.map((material) => (
          <Link key={material.id} href={`/materiales/${material.id}`}>
            <Card className="h-full shadow-sm transition-colors hover:bg-muted/30">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-primary">
                      {material.code}
                    </p>
                    <CardTitle className="text-base">{material.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {material.warehouse}
                    </CardDescription>
                  </div>
                  <MaterialStatusBadge status={material.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <MaterialCategoryBadge category={material.category} />
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="rounded-lg border bg-muted/20 p-2">
                    <p className="font-semibold tabular-nums text-foreground">
                      {material.stock.toLocaleString("es-MX")}
                    </p>
                    <p className="text-muted-foreground">Stock ({material.unit})</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-2">
                    <p className="font-semibold tabular-nums text-foreground">
                      {material.minStock.toLocaleString("es-MX")}
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
