"use client"

import {
  AlertTriangle,
  ArrowLeftRight,
  Package,
  PackageMinus,
} from "lucide-react"

import type { MaterialsSummary } from "@/lib/types/materials"
import type { VisualTone } from "@/lib/ui/visual-tokens"
import { KpiCard } from "@/components/ui/kpi-card"

const cards: {
  key: keyof MaterialsSummary
  label: string
  icon: typeof Package
  tone: VisualTone
  onClickKey?: "catalog"
}[] = [
  {
    key: "totalMaterials",
    label: "Materiales en catálogo",
    icon: Package,
    tone: "neutral",
    onClickKey: "catalog",
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
    key: "reservedQuantity",
    label: "Unidades Reservadas",
    icon: PackageMinus,
    tone: "green",
  },
]

type MaterialsSummaryCardsProps = {
  summary: MaterialsSummary | null
  isLoading?: boolean
  onOpenCatalog?: () => void
}

export function MaterialsSummaryCards({
  summary,
  isLoading = false,
  onOpenCatalog,
}: MaterialsSummaryCardsProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <KpiCard
          key={card.key}
          label={card.label}
          value={isLoading ? "—" : summary?.[card.key] ?? 0}
          icon={card.icon}
          tone={card.tone}
          onClick={
            card.onClickKey === "catalog" ? onOpenCatalog : undefined
          }
        />
      ))}
    </div>
  )
}
