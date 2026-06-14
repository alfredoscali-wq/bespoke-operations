import Link from "next/link"
import {
  ArrowDownRight,
  ArrowUpRight,
  Camera,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  HardHat,
  Minus,
  Radio,
  ShieldCheck,
  ShieldX,
  TowerControl,
  Users,
  type LucideIcon,
} from "lucide-react"

import type { KpiMetric } from "@/lib/data/dashboard"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const kpiIcons: Record<string, LucideIcon> = {
  "projects-active": TowerControl,
  "projects-closed": CheckCircle2,
  "tasks-pending": CircleDot,
  "tasks-in-progress": ClipboardList,
  "tasks-completed": CheckCircle2,
  "evidence-pending": Camera,
  "evidence-approved": ShieldCheck,
  "evidence-rejected": ShieldX,
  "crews-active": Users,
  "crews-field": HardHat,
  "active-projects": TowerControl,
  "pending-tasks": CircleDot,
  "active-crews": Radio,
  "overall-progress": ArrowUpRight,
}

type KpiCardProps = {
  metric: KpiMetric
}

export function KpiCard({ metric }: KpiCardProps) {
  const Icon = kpiIcons[metric.id] ?? CircleDot

  return (
    <Link href={metric.href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="shadow-sm transition-colors hover:bg-muted/20">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-2xl font-semibold tracking-tight">
                {metric.value}
              </CardTitle>
            </div>
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/8 text-primary">
              <Icon className="size-4" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs">
            {metric.trend === "up" && (
              <ArrowUpRight className="size-3.5 text-emerald-600" />
            )}
            {metric.trend === "down" && (
              <ArrowDownRight className="size-3.5 text-emerald-600" />
            )}
            {metric.trend === "neutral" && (
              <Minus className="size-3.5 text-muted-foreground" />
            )}
            <span
              className={cn(
                "font-medium",
                metric.trend === "up" && "text-emerald-600",
                metric.trend === "down" && "text-emerald-600",
                metric.trend === "neutral" && "text-muted-foreground"
              )}
            >
              {metric.change}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {metric.description}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}

export function KpiGrid({ metrics }: { metrics: KpiMetric[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {metrics.map((metric) => (
        <KpiCard key={metric.id} metric={metric} />
      ))}
    </div>
  )
}
