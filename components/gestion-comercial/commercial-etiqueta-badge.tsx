"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const FALLBACK_COLOR = "#64748b"

type CommercialEtiquetaBadgeProps = {
  name: string | null | undefined
  color?: string | null
  className?: string
}

export function CommercialEtiquetaBadge({
  name,
  color,
  className,
}: CommercialEtiquetaBadgeProps) {
  const label = name?.trim()
  if (!label) return null

  const hex = color?.trim() || FALLBACK_COLOR

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 border-transparent font-medium text-foreground",
        className
      )}
      style={{ backgroundColor: `${hex}22` }}
    >
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: hex }}
        aria-hidden
      />
      {label}
    </Badge>
  )
}
