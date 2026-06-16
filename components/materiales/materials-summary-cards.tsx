import {
  AlertTriangle,
  ArrowLeftRight,
  Package,
  PackageCheck,
} from "lucide-react"

import { getMaterialsSummary } from "@/lib/data/materials"
import type { MaterialsSummary } from "@/lib/types/materials"
import type { VisualTone } from "@/lib/ui/visual-tokens"
import { KpiCard } from "@/components/ui/kpi-card"

const cards: {
  key: keyof MaterialsSummary
  label: string
  icon: typeof Package
  tone: VisualTone
}[] = [
  {
    key: "totalMaterials",
    label: "Total de Materiales",
    icon: Package,
    tone: "neutral",
  },
  {
    key: "lowStockItems",
    label: "Stock Bajo",
    icon: AlertTriangle,
    tone: "yellow",
  },
  {
    key: "todaysMovements",
    label: "Movimientos Hoy",
    icon: ArrowLeftRight,
    tone: "blue",
  },
  {
    key: "assignedMaterials",
    label: "Materiales Asignados",
    icon: PackageCheck,
    tone: "green",
  },
]

export function MaterialsSummaryCards() {
  const summary = getMaterialsSummary()

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <KpiCard
          key={card.key}
          label={card.label}
          value={summary[card.key]}
          icon={card.icon}
          tone={card.tone}
        />
      ))}
    </div>
  )
}
