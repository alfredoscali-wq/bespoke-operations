import Link from "next/link"

import type { DashboardActivityItem } from "@/lib/data/dashboard"
import { getActivityTonePrefix } from "@/lib/data/dashboard"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const TONE_STYLES = {
  success: "text-emerald-700",
  warning: "text-amber-700",
  neutral: "text-muted-foreground",
} as const

type DashboardRecentActivityProps = {
  items: DashboardActivityItem[]
}

export function DashboardRecentActivity({
  items,
}: DashboardRecentActivityProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-1 border-b">
        <CardTitle className="text-base">Actividad Reciente</CardTitle>
        <CardDescription>
          Últimos eventos operativos registrados en el sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin actividad operativa reciente.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const content = (
                <span
                  className={cn(
                    "inline-flex items-start gap-2 text-sm",
                    TONE_STYLES[item.tone]
                  )}
                >
                  <span aria-hidden className="font-semibold">
                    {getActivityTonePrefix(item.tone)}
                  </span>
                  <span>{item.message}</span>
                </span>
              )

              if (!item.href) {
                return <li key={item.id}>{content}</li>
              }

              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="block rounded-lg px-1 py-0.5 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    {content}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
