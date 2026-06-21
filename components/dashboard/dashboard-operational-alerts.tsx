import Link from "next/link"

import type { DashboardOperationalAlert } from "@/lib/data/dashboard"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const ALERT_STYLES = {
  critical: "border-red-200/80 bg-red-50/90 text-red-950",
  warning: "border-amber-200/80 bg-amber-50/90 text-amber-950",
  success: "border-emerald-200/80 bg-emerald-50/90 text-emerald-950",
} as const

const ALERT_PREFIX = {
  critical: "🔴",
  warning: "🟡",
  success: "🟢",
} as const

type DashboardOperationalAlertsProps = {
  alerts: DashboardOperationalAlert[]
}

export function DashboardOperationalAlerts({
  alerts,
}: DashboardOperationalAlertsProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-1 border-b">
        <CardTitle className="text-base">Alertas Operativas</CardTitle>
        <CardDescription>
          Situaciones que requieren atención del supervisor
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 xl:grid-cols-3">
        {alerts.map((alert) => {
          const content = (
            <div
              className={cn(
                "rounded-xl border px-4 py-3 text-sm font-medium shadow-sm transition-colors",
                ALERT_STYLES[alert.severity],
                alert.href && "hover:brightness-[0.98]"
              )}
            >
              <span aria-hidden>{ALERT_PREFIX[alert.severity]} </span>
              {alert.message}
            </div>
          )

          if (!alert.href) {
            return <div key={alert.id}>{content}</div>
          }

          return (
            <Link
              key={alert.id}
              href={alert.href}
              className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {content}
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
