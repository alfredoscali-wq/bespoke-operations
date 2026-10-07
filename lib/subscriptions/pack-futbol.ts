export const PACK_FUTBOL_CODE = "PACK-FUTBOL"
export const TV_FULL_UPGRADE_CODE = "TV-FULL-UPGRADE"

export type CommercialTvTier = "basica" | "full" | "none"

/**
 * TV Básica is the included TV-BASICO plan without TV-FULL-UPGRADE.
 * TV Full is the active TV-FULL-UPGRADE component.
 * The historical TV-FULL and TV-BASICO-FUTBOL catalog plans do not decide this.
 */
export function commercialTvTier(input: {
  includedTvCode: string | null
  activeComponentCodes: readonly string[]
}): CommercialTvTier {
  const included = input.includedTvCode?.trim().toLowerCase() ?? ""
  const hasFullUpgrade = input.activeComponentCodes.some(
    (code) => code.trim().toUpperCase() === TV_FULL_UPGRADE_CODE
  )
  if (hasFullUpgrade) return "full"
  if (included === "tv-basico") return "basica"
  return "none"
}

export function commercialTvTierLabel(tier: CommercialTvTier): string | null {
  if (tier === "basica") return "TV Básica"
  if (tier === "full") return "TV Full"
  return null
}

export function canOfferPackFutbol(input: {
  tier: CommercialTvTier
  packFutbolActive: boolean
  packPrice: number | null
}): boolean {
  if (input.packFutbolActive) return false
  if (input.tier !== "basica" && input.tier !== "full") return false
  return input.packPrice != null && input.packPrice >= 0
}
