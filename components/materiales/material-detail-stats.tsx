import {
  ArrowLeftRight,
  PackageCheck,
  PackageOpen,
  Warehouse,
} from "lucide-react"

import type { Material, MaterialDetail } from "@/lib/types/materials"
import { formatMaterialDateTime } from "@/lib/materials/constants"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type MaterialDetailStatsProps = {
  material: Material
  stats: MaterialDetail["stats"]
}

const statItems = [
  {
    key: "stock" as const,
    label: "Stock Actual",
    icon: PackageOpen,
    color: "text-primary bg-primary/8",
    getValue: (material: Material) =>
      material.stock.toLocaleString("es-MX"),
    suffix: (material: Material) => material.unit,
  },
  {
    key: "assigned" as const,
    label: "Cantidad Asignada",
    icon: PackageCheck,
    color: "text-emerald-600 bg-emerald-50",
    getValue: (_material: Material, stats: MaterialDetail["stats"]) =>
      stats.assignedQuantity.toLocaleString("es-MX"),
    suffix: (material: Material) => material.unit,
  },
  {
    key: "movements" as const,
    label: "Movimientos",
    icon: ArrowLeftRight,
    color: "text-blue-600 bg-blue-50",
    getValue: (_material: Material, stats: MaterialDetail["stats"]) =>
      stats.totalMovements.toString(),
    suffix: () => "registros",
  },
  {
    key: "warehouse" as const,
    label: "Último Movimiento",
    icon: Warehouse,
    color: "text-amber-600 bg-amber-50",
    getValue: (_material: Material, stats: MaterialDetail["stats"]) =>
      stats.lastMovementAt
        ? formatMaterialDateTime(stats.lastMovementAt)
        : "Sin movimientos",
    suffix: () => "",
  },
]

export function MaterialDetailStats({
  material,
  stats,
}: MaterialDetailStatsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {statItems.map((item) => {
        const Icon = item.icon
        const value = item.getValue(material, stats)
        const suffix = item.suffix(material)

        return (
          <Card key={item.key} className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {item.label}
                </CardTitle>
                <div
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg",
                    item.color
                  )}
                >
                  <Icon className="size-4" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">
                {value}
              </p>
              {suffix && (
                <p className="mt-1 text-xs text-muted-foreground">{suffix}</p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
