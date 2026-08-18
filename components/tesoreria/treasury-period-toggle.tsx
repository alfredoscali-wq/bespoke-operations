"use client"

import { TREASURY_HISTORY_RANGE_OPTIONS } from "@/lib/tesoreria/summary"
import type { TreasuryHistoryRange } from "@/lib/types/tesoreria"
import { Button } from "@/components/ui/button"

type TreasuryPeriodToggleProps = {
  value: TreasuryHistoryRange
  onChange: (range: TreasuryHistoryRange) => void
}

export function TreasuryPeriodToggle({
  value,
  onChange,
}: TreasuryPeriodToggleProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TREASURY_HISTORY_RANGE_OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? "default" : "outline"}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
