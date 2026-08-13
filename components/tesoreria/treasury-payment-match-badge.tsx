"use client"

import { Badge } from "@/components/ui/badge"
import {
  formatTreasuryPaymentMethodLabel,
  resolveOtRenditionPaymentMatch,
} from "@/lib/tesoreria/ot-rendition-payment"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type TreasuryPaymentMatchBadgeProps = {
  expected: string | null | undefined
  received: string | null | undefined
  className?: string
}

/** Tesorería 2.2A — only show when received ≠ expected (hide match state). */
export function TreasuryPaymentMatchBadge({
  expected,
  received,
  className,
}: TreasuryPaymentMatchBadgeProps) {
  const match = resolveOtRenditionPaymentMatch(expected, received)
  if (match !== "modified") return null

  const detail = [
    `Esperado: ${formatTreasuryPaymentMethodLabel(expected)}`,
    `Cobrado: ${formatTreasuryPaymentMethodLabel(received)}`,
  ].join("\n")

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "cursor-default border-amber-300 bg-amber-50 text-[10px] font-medium text-amber-900",
              className
            )}
          >
            ⚠ Medio Modificado
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="whitespace-pre-line text-xs">
          {detail}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
