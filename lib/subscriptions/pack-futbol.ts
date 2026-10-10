export const PACK_FUTBOL_CODE = "PACK-FUTBOL"

export const PACK_FUTBOL_ASSIGNMENT_DISABLED_MESSAGE =
  "Agregar Pack Fútbol está deshabilitado hasta validar el recálculo del abono."

export function isPackFutbolAssignmentEnabled(source?: {
  PACK_FUTBOL_ASSIGNMENT_ENABLED?: string
}): boolean {
  const value = (source ?? process.env).PACK_FUTBOL_ASSIGNMENT_ENABLED
  return value?.trim().toLowerCase() === "true"
}
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

export type PackFutbolResponseOutcome =
  | { type: "error"; message: string; refresh: false }
  | { type: "already_active"; refresh: true }
  | { type: "assigned"; refresh: true }
  | { type: "available"; refresh: false }

export function interpretPackFutbolResponse(input: {
  ok: boolean
  success?: boolean
  status?: string | null
  message?: string | null
  fallback: string
}): PackFutbolResponseOutcome {
  if (!input.ok || input.success !== true) {
    const message = input.message?.trim() || input.fallback
    return { type: "error", message, refresh: false }
  }
  if (input.status === "already_active") {
    return { type: "already_active", refresh: true }
  }
  if (input.status === "assigned") {
    return { type: "assigned", refresh: true }
  }
  if (input.status === "available") {
    return { type: "available", refresh: false }
  }
  return { type: "error", message: input.fallback, refresh: false }
}

export function canConfirmPackFutbol(status: string | null | undefined): boolean {
  return status === "available"
}

export function canSubmitPackFutbolAssignment(input: {
  assignmentEnabled: boolean
  status: string | null | undefined
}): boolean {
  return input.assignmentEnabled === true && canConfirmPackFutbol(input.status)
}

export function packFutbolQuotedFees(quote: {
  currentMonthlyFee: number
  packPrice: number
  nextMonthlyFee: number
}): {
  currentMonthlyFee: number
  packMonthlyPrice: number
  nextMonthlyFee: number
} {
  return {
    currentMonthlyFee: quote.currentMonthlyFee,
    packMonthlyPrice: quote.packPrice,
    nextMonthlyFee: quote.nextMonthlyFee,
  }
}
