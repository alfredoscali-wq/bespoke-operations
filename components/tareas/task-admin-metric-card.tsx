import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type TaskAdminMetricCardProps = {
  icon: ReactNode
  label: string
  value: ReactNode
  className?: string
}

export function TaskAdminMetricCard({
  icon,
  label,
  value,
  className,
}: TaskAdminMetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/20 p-3",
        className
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span aria-hidden>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}
