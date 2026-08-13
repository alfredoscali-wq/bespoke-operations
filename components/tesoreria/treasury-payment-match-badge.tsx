"use client"

import { Badge } from "@/components/ui/badge"
import { resolveOtRenditionPaymentMatch } from "@/lib/tesoreria/ot-rendition-payment"
import { cn } from "@/lib/utils"

type TreasuryPaymentMatchBadgeProps = {
  expected: string | null | undefined
  received: string | null | undefined
  className?: string
}

export function TreasuryPaymentMatchBadge({
  expected,
  received,
  className,
}: TreasuryPaymentMatchBadgeProps) {
  const match = resolveOtRenditionPaymentMatch(expected, received)
  if (!match) return null

  if (match === "match") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "border-emerald-200 bg-emerald-50 text-[10px] font-medium text-emerald-800",
          className
        )}
      >
        ✓ Coincide
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "border-amber-300 bg-amber-50 text-[10px] font-medium text-amber-900",
        className
      )}
    >
      ⚠ Medio Modificado
    </Badge>
  )
}
