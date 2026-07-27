/**
 * Presentation helpers for Atención consultations handed off to Gestión Comercial.
 */

export const COMMERCIAL_SALES_HANDOFF_RESOLUTION_PREFIX =
  "Derivada a Gestión Comercial"

const OPPORTUNITY_CODE_RE = /\b(OP-\d{6})\b/i

export type CommercialOpportunityLink = {
  id: string
  code: string
}

export function isCommercialSalesHandoffResolution(
  resolution: string | null | undefined
): boolean {
  const text = resolution?.trim() ?? ""
  if (!text) return false
  return (
    text.startsWith(COMMERCIAL_SALES_HANDOFF_RESOLUTION_PREFIX) ||
    /derivada a gesti[oó]n comercial/i.test(text)
  )
}

export function extractCommercialOpportunityCode(
  resolution: string | null | undefined
): string | null {
  const match = resolution?.match(OPPORTUNITY_CODE_RE)
  return match?.[1]?.toUpperCase() ?? null
}

export function isCommercialSalesHandoff(row: {
  status: string
  resolution?: string | null
}): boolean {
  return (
    row.status === "resuelta" &&
    isCommercialSalesHandoffResolution(row.resolution)
  )
}

export function buildCommercialSalesHandoffResolution(
  opportunityCode: string
): string {
  return `${COMMERCIAL_SALES_HANDOFF_RESOLUTION_PREFIX} (${opportunityCode}). La oportunidad quedó a cargo del módulo comercial.`
}
