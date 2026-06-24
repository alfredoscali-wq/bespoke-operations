import type { LucideIcon } from "lucide-react"

import type { VisualTone } from "@/lib/ui/visual-tokens"
import { KPI_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type KpiCardProps = {
  label: string
  value: number | string
  icon: LucideIcon
  tone?: VisualTone
  hint?: React.ReactNode
  compact?: boolean
  className?: string
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  hint,
  compact = false,
  className,
}: KpiCardProps) {
  const styles = KPI_TONE_STYLES[tone]

  if (compact) {
    return (
      <Card className={cn("shadow-sm", styles.card, className)}>
        <CardContent className="flex items-center justify-between gap-2 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium text-muted-foreground">
              {label}
            </p>
            <p className="text-lg font-semibold leading-tight tracking-tight tabular-nums text-foreground">
              {value}
            </p>
            {hint ? (
              <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                {hint}
              </div>
            ) : null}
          </div>
          <div
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md",
              styles.icon
            )}
          >
            <Icon className={cn("size-3.5", styles.iconColor)} />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("shadow-sm", styles.card, className)}>
      <CardHeader className="px-5 pb-2 pt-5">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              styles.icon
            )}
          >
            <Icon className={cn("size-4", styles.iconColor)} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
          {value}
        </p>
        {hint ? (
          <div className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {hint}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
