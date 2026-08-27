import { BILLING_DOCUMENT_VISUAL } from "@/lib/isp/billing-document-template"

/** CSS px at 96dpi → millimetres. Preview is the source of truth. */
export function billingPxToMm(px: number): number {
  return px / (96 / 25.4)
}

/** CSS px → PDF points (jsPDF fontSize). */
export function billingPxToPt(px: number): number {
  return px * 0.75
}

/**
 * Shared A4 layout for the HTML sheet and the PDF renderer.
 * Values match the approved preview. Do not diverge per surface.
 */
export const BILLING_DOCUMENT_LAYOUT = {
  page: {
    widthMm: 210,
    heightMm: 297,
  },
  margin: {
    topMm: 20,
    xMm: 20,
    bottomMm: 18,
  },
  colors: BILLING_DOCUMENT_VISUAL,
  logo: {
    heightPx: 64,
    maxWidthPx: 220,
    heightMm: billingPxToMm(64),
    maxWidthMm: billingPxToMm(220),
    gapBelowMm: billingPxToMm(14),
  },
  header: {
    columnGapPx: 48,
    columnGapMm: billingPxToMm(48),
    identMaxPercent: 44,
    identWidthPx: 248,
    identWidthMm: billingPxToMm(248),
    identPadLeftPx: 32,
    identPadLeftMm: billingPxToMm(32),
    cardWidthPx: 148,
    cardWidthMm: billingPxToMm(148),
    cardPadXMm: billingPxToMm(16),
    cardPadYMm: billingPxToMm(14),
    letterSizePx: 52,
    letterSizeMm: billingPxToMm(52),
    letterFontPx: 28,
    kindToLetterMm: billingPxToMm(10),
    afterCardMm: billingPxToMm(20),
    metaRowMm: billingPxToMm(8),
    afterHeaderMm: billingPxToMm(36),
  },
  type: {
    sectionLabelPx: 9,
    issuerNamePx: 15.5,
    issuerDetailPx: 11,
    identKindPx: 11,
    identMetaLabelPx: 10.5,
    identMetaValuePx: 11,
    customerNamePx: 13.5,
    customerDetailPx: 11,
    tablePx: 10.5,
    totalsPx: 11,
    totalPx: 15,
    observationsPx: 11,
    footerLegendPx: 9,
    caePx: 10,
    qrCaptionPx: 8,
  },
  rhythm: {
    issuerNameLineMm: billingPxToMm(15.5 * 1.375),
    customerNameLineMm: billingPxToMm(13.5 * 1.375),
    issuerLineMm: billingPxToMm(17),
    issuerStackMm: billingPxToMm(6),
    afterHairlineMm: billingPxToMm(28),
    afterSectionLabelMm: billingPxToMm(14),
    afterCustomerMm: billingPxToMm(36),
    afterTableMm: billingPxToMm(40),
    totalsRowMm: billingPxToMm(10),
    afterTotalsMm: billingPxToMm(48),
    beforeFooterMm: billingPxToMm(56),
    footerPadTopMm: billingPxToMm(24),
  },
  table: {
    columns: [5, 34, 8, 14, 13, 13, 13] as const,
    headerHeightMm: billingPxToMm(28),
    rowPadMm: billingPxToMm(10),
    lineMm: billingPxToMm(10.5 * 1.5),
  },
  customer: {
    widthPx: 448,
    widthMm: billingPxToMm(448),
  },
  totals: {
    widthPx: 220,
    widthMm: billingPxToMm(220),
    totalGapMm: billingPxToMm(14),
  },
  observations: {
    widthPx: 512,
    widthMm: billingPxToMm(512),
  },
  footer: {
    qrSizePx: 72,
    qrSizeMm: billingPxToMm(72),
    caeWidthPx: 158,
    caeWidthMm: billingPxToMm(158),
    columnGapMm: billingPxToMm(40),
    heightMm: billingPxToMm(110),
  },
} as const

export type BillingDocumentLayout = typeof BILLING_DOCUMENT_LAYOUT
