"use client"

import { useTreasury } from "@/components/tesoreria/treasury-provider"
import { formatTreasuryHistoryFilterBanner } from "@/lib/tesoreria/history-filter"
import { Button } from "@/components/ui/button"

export function TreasuryHistoryFilterBanner() {
  const { historyFilter, historyRange, clearHistoryFilter } = useTreasury()
  const caption = formatTreasuryHistoryFilterBanner(historyFilter, historyRange)
  if (!caption) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-sm font-medium">{caption}</p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={clearHistoryFilter}
      >
        Limpiar filtro
      </Button>
    </div>
  )
}
