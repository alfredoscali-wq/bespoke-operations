import type { LucideIcon } from "lucide-react"

import type { DashboardStatusKpi } from "@/lib/data/dashboard"
import type { VisualTone } from "@/lib/ui/visual-tokens"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type DashboardStatusSectionProps = {
  title: string
  description: string
  kpis: DashboardStatusKpi[]
  icons: Record<string, LucideIcon>
  tones: Record<string, VisualTone>
  columnsClassName?: string
  layout?: "standard" | "wide"
}

export function DashboardStatusSection({
  title,
  description,
  kpis,
  icons,
  tones,
  layout = "standard",
}: DashboardStatusSectionProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-1 border-b">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <KpiCardGrid layout={layout}>
          {kpis.map((kpi) => {
            const Icon = icons[kpi.id]
            const tone = tones[kpi.id] ?? "neutral"

            return (
              <FilterableKpiCard
                key={kpi.id}
                label={kpi.label}
                value={kpi.value}
                icon={Icon}
                tone={tone}
                href={kpi.href}
              />
            )
          })}
        </KpiCardGrid>
      </CardContent>
    </Card>
  )
}
