"use client"

import { Badge } from "@/components/ui/badge"
import {
  COMMERCIAL_PRIORITY_LABELS,
  COMMERCIAL_STATUS_LABELS,
  type CommercialPriorityCode,
  type CommercialStatusCode,
} from "@/lib/commercial/catalogs"
import { cn } from "@/lib/utils"

type CommercialBadgeProps = {
  kind: "status" | "priority"
  value: CommercialStatusCode | CommercialPriorityCode
  className?: string
}

export function CommercialBadge({ kind, value, className }: CommercialBadgeProps) {
  const label =
    kind === "status"
      ? COMMERCIAL_STATUS_LABELS[value as CommercialStatusCode]
      : COMMERCIAL_PRIORITY_LABELS[value as CommercialPriorityCode]

  const variant =
    kind === "status"
      ? value === "ganada"
        ? "default"
        : value === "perdida"
          ? "destructive"
          : "secondary"
      : value === "alta"
        ? "destructive"
        : value === "media"
          ? "secondary"
          : "outline"

  return (
    <Badge variant={variant} className={cn(className)}>
      {label}
    </Badge>
  )
}
