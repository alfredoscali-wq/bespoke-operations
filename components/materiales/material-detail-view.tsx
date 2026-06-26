"use client"

import Link from "next/link"
import { ArrowLeft, MoreHorizontal } from "lucide-react"

import { MaterialDetailStats } from "@/components/materiales/material-detail-stats"
import {
  MaterialCategoryBadge,
  MaterialStatusBadge,
} from "@/components/materiales/material-badges"
import { MaterialAssignmentsTab } from "@/components/materiales/material-tabs/assignments-tab"
import { MaterialHistoryTab } from "@/components/materiales/material-tabs/history-tab"
import { MaterialMovementsTab } from "@/components/materiales/material-tabs/movements-tab"
import { MaterialOverviewTab } from "@/components/materiales/material-tabs/overview-tab"
import type { Material, MaterialDetail } from "@/lib/types/materials"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type MaterialDetailViewProps = {
  material: Material
  detail: MaterialDetail
}

export function MaterialDetailView({
  material,
  detail,
}: MaterialDetailViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
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
              <MaterialStatusBadge status={material.status} />
              <span className="rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                {material.code}
              </span>
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {material.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {material.manufacturer} · {material.warehouse}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 self-start">
              Acciones
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Registrar entrada</DropdownMenuItem>
            <DropdownMenuItem>Registrar salida</DropdownMenuItem>
            <DropdownMenuItem>Asignar a OT</DropdownMenuItem>
            <DropdownMenuItem>Exportar ficha</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Información del material</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Stock</p>
            <p className="text-sm font-medium tabular-nums">
              {material.stock.toLocaleString("es-MX")} {material.unit}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Categoría</p>
            <div className="mt-1">
              <MaterialCategoryBadge category={material.category} />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Almacén</p>
            <p className="text-sm font-medium">{material.warehouse}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Estado</p>
            <div className="mt-1">
              <MaterialStatusBadge status={material.status} />
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
              Asignaciones ({detail.assignments.length})
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
          <MaterialAssignmentsTab assignments={detail.assignments} />
        </TabsContent>
        <TabsContent value="history">
          <MaterialHistoryTab history={detail.history} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
