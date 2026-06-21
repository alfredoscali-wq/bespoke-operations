import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import type { DashboardStatusKpi } from "@/lib/data/dashboard"
import type { VisualTone } from "@/lib/ui/visual-tokens"
import { KpiCard } from "@/components/ui/kpi-card"
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
}

export function DashboardStatusSection({
  title,
  description,
  kpis,
  icons,
  tones,
  columnsClassName = "sm:grid-cols-2 xl:grid-cols-4",
}: DashboardStatusSectionProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-1 border-b">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className={`grid gap-5 ${columnsClassName}`}>
          {kpis.map((kpi) => {
            const Icon = icons[kpi.id]
            const tone = tones[kpi.id] ?? "neutral"

            return (
              <Link
                key={kpi.id}
                href={kpi.href}
                className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <KpiCard
                  label={kpi.label}
                  value={kpi.value}
                  icon={Icon}
                  tone={tone}
                  className="h-full transition-shadow hover:shadow-md"
                />
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
