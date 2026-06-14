import {
  Building2,
  Factory,
  Package,
  Warehouse,
} from "lucide-react"

import {
  MaterialCategoryBadge,
  MaterialStatusBadge,
} from "@/components/materiales/material-badges"
import type { Material } from "@/lib/types/materials"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type MaterialOverviewTabProps = {
  material: Material
}

export function MaterialOverviewTab({ material }: MaterialOverviewTabProps) {
  const stockRatio = Math.min(
    100,
    material.minStock > 0
      ? Math.round((material.stock / (material.minStock * 2)) * 100)
      : material.stock > 0
        ? 100
        : 0
  )

  const infoItems = [
    {
      icon: Package,
      label: "Código",
      value: material.code,
    },
    {
      icon: Factory,
      label: "Fabricante",
      value: material.manufacturer,
    },
    {
      icon: Warehouse,
      label: "Almacén",
      value: material.warehouse,
    },
    {
      icon: Building2,
      label: "Stock mínimo",
      value: `${material.minStock.toLocaleString("es-MX")} ${material.unit}`,
    },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="shadow-sm lg:col-span-2">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-primary">
              {material.code}
            </span>
            <MaterialCategoryBadge category={material.category} />
            <MaterialStatusBadge status={material.status} />
          </div>
          <CardTitle className="text-lg">{material.name}</CardTitle>
          <CardDescription>{material.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {infoItems.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.label}
                  className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-medium text-foreground">
                      {item.value}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Nivel de inventario</CardTitle>
          <CardDescription>
            Stock actual vs. mínimo requerido
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between">
            <span className="text-4xl font-semibold tracking-tight tabular-nums">
              {material.stock.toLocaleString("es-MX")}
            </span>
            <span className="text-sm text-muted-foreground">
              {material.unit}
            </span>
          </div>
          <Progress value={stockRatio} className="h-2.5" />
          <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
            <p>
              Mínimo operativo:{" "}
              <span className="font-medium text-foreground">
                {material.minStock.toLocaleString("es-MX")} {material.unit}
              </span>
            </p>
            <p className="mt-2 leading-relaxed">
              {material.status === "out-of-stock"
                ? "Material agotado. Se requiere reposición urgente."
                : material.status === "low-stock"
                  ? "Stock por debajo del mínimo. Programar reabastecimiento."
                  : "Inventario dentro de parámetros operativos."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
