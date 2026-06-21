"use client"

import { Cable, Radio, UserCheck, UserX } from "lucide-react"

import { useCustomersUI } from "@/components/clientes/customers-ui-provider"
import { KpiCard } from "@/components/ui/kpi-card"
import {
  CUSTOMER_CATEGORY_KPI_LABELS,
  CUSTOMER_CATEGORY_KPI_TONE,
  CUSTOMER_CATEGORY_ORDER,
  type CustomerCategory,
} from "@/lib/customers/customer-category"
import { cn } from "@/lib/utils"

const CATEGORY_ICONS = {
  activo: UserCheck,
  inactivo: UserX,
  fiber: Cable,
  wireless: Radio,
} as const

export function CustomersSummary() {
  const { categorySummary, selectedCategory, openCategory } = useCustomersUI()

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {CUSTOMER_CATEGORY_ORDER.map((category) => {
        const isActive = selectedCategory === category
        const Icon = CATEGORY_ICONS[category]

        return (
          <CategoryKpiButton
            key={category}
            isActive={isActive}
            label={CUSTOMER_CATEGORY_KPI_LABELS[category]}
            value={categorySummary[category]}
            icon={Icon}
            tone={CUSTOMER_CATEGORY_KPI_TONE[category]}
            onClick={() => openCategory(category)}
          />
        )
      })}
    </div>
  )
}

function CategoryKpiButton({
  isActive,
  label,
  value,
  icon: Icon,
  tone,
  onClick,
}: {
  isActive: boolean
  label: string
  value: number
  icon: typeof UserCheck
  tone: (typeof CUSTOMER_CATEGORY_KPI_TONE)[CustomerCategory]
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        isActive && "ring-2 ring-primary/25"
      )}
    >
      <KpiCard
        label={label}
        value={value}
        icon={Icon}
        tone={tone}
        className={cn(
          "h-full cursor-pointer transition-shadow hover:shadow-md",
          isActive && "shadow-md"
        )}
      />
    </button>
  )
}
