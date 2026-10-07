import {
  ABNET_TV_BASICA_AMOUNT,
  ABNET_TV_BASICA_PACK_AMOUNT,
  ABNET_TV_FULL_AMOUNT,
  formatAbnetPadronMoney,
  type AbnetTvKind,
} from "@/lib/subscriptions/abnet-tv-padron"

export const ABNET_TV_PLAN_OPTIONS = [
  { id: "basica", label: "TV Básica", amount: ABNET_TV_BASICA_AMOUNT },
  {
    id: "pack",
    label: "TV Básica + Pack Fútbol",
    amount: ABNET_TV_BASICA_PACK_AMOUNT,
  },
  { id: "full", label: "TV Full", amount: ABNET_TV_FULL_AMOUNT },
] as const

export type AbnetTvPlanOptionId = (typeof ABNET_TV_PLAN_OPTIONS)[number]["id"]

export function abnetTvJubiladoHalf(amount: number): number {
  return amount / 2
}

/** Current option for the selector. Half-price jubilado rows still map to their plan. */
export function currentAbnetTvPlanOption(row: {
  tvKind: AbnetTvKind
  tvAmount: number | null
  jubilado: boolean
}): AbnetTvPlanOptionId | null {
  if (row.tvKind === "basica" || row.tvKind === "pack" || row.tvKind === "full") {
    return row.tvKind
  }
  if (!row.jubilado || row.tvAmount == null) return null
  return (
    ABNET_TV_PLAN_OPTIONS.find((option) => option.amount / 2 === row.tvAmount)?.id ??
    null
  )
}

export function abnetTvPlanSelectionNotice(optionId: AbnetTvPlanOptionId): {
  headline: string
  detail: string
} {
  const option = ABNET_TV_PLAN_OPTIONS.find((item) => item.id === optionId)
  if (!option) {
    throw new Error("Plan de TV desconocido.")
  }
  return {
    headline: `Plan seleccionado: ${option.label} — ${formatAbnetPadronMoney(option.amount)}`,
    detail: "Este cambio todavía no se aplica en ABNet.",
  }
}
