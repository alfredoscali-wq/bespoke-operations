import {
  AlertTriangle,
  ArrowLeftRight,
  Package,
  PackageCheck,
} from "lucide-react"

import { getMaterialsSummary } from "@/lib/data/materials"
import type { MaterialsSummary } from "@/lib/types/materials"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const cards = [
  {
    key: "totalMaterials" as keyof MaterialsSummary,
    label: "Total de Materiales",
    icon: Package,
    color: "text-primary bg-primary/8",
  },
  {
    key: "lowStockItems" as keyof MaterialsSummary,
    label: "Stock Bajo",
    icon: AlertTriangle,
    color: "text-amber-600 bg-amber-50",
  },
  {
    key: "todaysMovements" as keyof MaterialsSummary,
    label: "Movimientos Hoy",
    icon: ArrowLeftRight,
    color: "text-blue-600 bg-blue-50",
  },
  {
    key: "assignedMaterials" as keyof MaterialsSummary,
    label: "Materiales Asignados",
    icon: PackageCheck,
    color: "text-emerald-600 bg-emerald-50",
  },
]

export function MaterialsSummaryCards() {
  const summary = getMaterialsSummary()

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        const value = summary[card.key]

        return (
          <Card key={card.key} className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <div
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg",
                    card.color
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
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
