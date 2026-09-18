export type TreasuryCashOpening = {
  companyId: string
  openingBalance: number
  asOfDate: string
  notes: string
}

export const EMPTY_TREASURY_CASH_OPENING: TreasuryCashOpening = {
  companyId: "",
  openingBalance: 0,
  asOfDate: "",
  notes: "",
}

export function hasTreasuryCashOpening(
  opening: Pick<TreasuryCashOpening, "asOfDate"> | null | undefined
): boolean {
  return Boolean(opening?.asOfDate?.trim())
}
