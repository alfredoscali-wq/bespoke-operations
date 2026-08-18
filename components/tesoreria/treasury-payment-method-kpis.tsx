"use client"

import { useMemo, useState } from "react"
import {
  Banknote,
  CreditCard,
  Ellipsis,
  Info,
  Landmark,
  Smartphone,
  WalletCards,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { useTreasury } from "@/components/tesoreria/treasury-provider"
import {
  buildTreasuryIncomeCompositionKpis,
  TREASURY_PAYMENT_METHOD_KPI_HINT,
  type TreasuryPaymentMethodKpiKey,
} from "@/lib/tesoreria/ot-rendition-payment-kpis"
import { formatTreasuryAmount } from "@/lib/tesoreria/summary"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const KPI_ICONS: Record<TreasuryPaymentMethodKpiKey, LucideIcon> = {
  efectivo: Banknote,
  transferencia: Landmark,
  mercadopago: Smartphone,
  tarjetas: CreditCard,
  cheque: WalletCards,
  otro: Ellipsis,
}

export function TreasuryPaymentMethodKpis() {
  const { movements, isReady, historyRange } = useTreasury()
  const [now] = useState(() => new Date())

  const items = useMemo(
    () => buildTreasuryIncomeCompositionKpis(movements, historyRange, now),
    [movements, historyRange, now]
  )

  return (
    <div className="rounded-lg border bg-muted/20 p-2">
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <p className="text-xs font-medium text-muted-foreground">
          Composición de la cobranza
        </p>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                aria-label={TREASURY_PAYMENT_METHOD_KPI_HINT}
              >
                <Info className="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {TREASURY_PAYMENT_METHOD_KPI_HINT}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {items.map((item) => (
          <FilterableKpiCard
            key={item.key}
            label={item.label}
            value={formatTreasuryAmount(item.amount)}
            icon={KPI_ICONS[item.key]}
            tone="gray"
            compact
            disabled
            isLoading={!isReady}
            cardClassName="min-h-[4.5rem]"
            ariaLabel={`${item.label}: ${formatTreasuryAmount(item.amount)}`}
          />
        ))}
      </div>
    </div>
  )
}
