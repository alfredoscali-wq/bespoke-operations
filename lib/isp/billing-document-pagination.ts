import { jsPDF } from "jspdf"

import {
  BILLING_DOCUMENT_LAYOUT as L,
  billingContentBottomMm,
  billingInnerBottomMm,
  billingPxToMm,
  billingPxToPt,
} from "@/lib/isp/billing-document-layout"
import type { BillingDocumentTemplateModel } from "@/lib/isp/billing-document-template"

export type BillingDocumentPageSlice = {
  pageIndex: number
  showDocumentHeader: boolean
  showCustomer: boolean
  showTableHeader: boolean
  itemIndices: number[]
  showTotals: boolean
  showObservations: boolean
}

export type BillingDocumentPagePlan = {
  pages: BillingDocumentPageSlice[]
  contentBottomMm: number
  innerBottomMm: number
}

const MARGIN_TOP = L.margin.topMm
const MARGIN_X = L.margin.xMm

function pdfSafeText(text: string): string {
  return text.replaceAll("\u2212", "-")
}

function createMeasureDoc(): jsPDF {
  return new jsPDF({ unit: "mm", format: "a4" })
}

function usableWidth(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth() - MARGIN_X * 2
}

function tableDescriptionWidth(doc: jsPDF): number {
  const usable = usableWidth(doc)
  const widths = L.table.columns.map((percent) => (usable * percent) / 100)
  const pad = 2.2
  const descriptionCol = widths[1]
  return descriptionCol - pad * 2
}

function sectionLabelHeightMm(): number {
  return (
    billingPxToMm(L.type.sectionLabelPx * 1.375) + L.rhythm.afterSectionLabelMm
  )
}

function measureWrappedHeight(
  doc: jsPDF,
  text: string,
  maxWidth: number,
  lineMm: number
): number {
  const lines = doc.splitTextToSize(pdfSafeText(text), maxWidth) as string[]
  return Math.max(lineMm, lines.length * lineMm)
}

function measureIdentificationBlockHeight(
  doc: jsPDF,
  model: BillingDocumentTemplateModel
): number {
  const letter = model.identification.letter
  const showKindLabel = letter !== "X"
  const kindLabel = model.identification.kindLabel
  const cardWidth = L.header.cardWidthMm
  const box = L.header.letterSizeMm
  const kindPx = kindLabel.length > 10 ? 9 : L.type.identKindPx
  const kindLineMm = billingPxToMm(kindPx * 1.375)
  const cardHeight =
    L.header.cardPadYMm +
    (showKindLabel ? kindLineMm : 0) +
    (showKindLabel && letter ? L.header.kindToLetterMm : 0) +
    (letter ? box : 0) +
    L.header.cardPadYMm

  let cursor = cardHeight + L.header.afterCardMm
  const right = doc.internal.pageSize.getWidth() - MARGIN_X
  const identWidth = Math.min(
    L.header.identWidthMm,
    (usableWidth(doc) * L.header.identMaxPercent) / 100
  )
  const contentLeft = right - identWidth + L.header.identPadLeftMm
  const identInner = right - contentLeft
  const usable = Math.max(24, identInner - L.header.metaGapMm)
  const valueWidth = (usable * L.header.metaValuePercent) / 100
  const labelWidth = (usable * L.header.metaLabelPercent) / 100
  const metaLineMm = billingPxToMm(L.type.identMetaValuePx * 1.375)

  const rows: Array<[string, string]> = [
    ["Punto de venta", model.identification.pointOfSaleLabel],
    ["Número", model.identification.documentNumberLabel],
    ["Fecha", model.identification.issueDateLabel],
  ]
  if (model.identification.dueDateLabel) {
    rows.push(["Vencimiento", model.identification.dueDateLabel])
  }
  if (model.identification.vatConditionLabel) {
    rows.push(["Condición frente al IVA", model.identification.vatConditionLabel])
  }

  for (const [label, value] of rows) {
    const labelLines = doc.splitTextToSize(pdfSafeText(label), labelWidth) as string[]
    const valueLines = doc.splitTextToSize(pdfSafeText(value), valueWidth) as string[]
    const lineCount = Math.max(labelLines.length, valueLines.length, 1)
    cursor += lineCount * metaLineMm + L.header.metaRowMm
  }

  return cursor
}

function measureIssuerBlockHeight(
  doc: jsPDF,
  model: BillingDocumentTemplateModel,
  hasLogo: boolean
): number {
  const identX =
    doc.internal.pageSize.getWidth() -
    MARGIN_X -
    Math.min(
      L.header.identWidthMm,
      (usableWidth(doc) * L.header.identMaxPercent) / 100
    )
  const leftWidth = identX - MARGIN_X - L.header.columnGapMm
  const nameAscent = billingPxToMm(L.type.issuerNamePx * 0.8)
  let textY = MARGIN_TOP + nameAscent
  if (hasLogo) {
    textY = MARGIN_TOP + L.logo.heightMm + L.logo.gapBelowMm + nameAscent
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(billingPxToPt(L.type.issuerNamePx))
  const nameLines = doc.splitTextToSize(
    pdfSafeText(model.issuer.legalName),
    leftWidth
  ) as string[]
  textY += nameLines.length * L.rhythm.issuerNameLineMm + L.rhythm.issuerStackMm

  const issuerLines = [
    model.issuer.taxId ? `CUIT ${model.issuer.taxId}` : null,
    model.issuer.vatConditionLabel !== "—" ? model.issuer.vatConditionLabel : null,
    model.issuer.addressLine,
    model.issuer.localityLine,
    model.issuer.phone,
    model.issuer.email,
    model.issuer.website,
  ].filter((line): line is string => Boolean(line))

  doc.setFont("helvetica", "normal")
  doc.setFontSize(billingPxToPt(L.type.issuerDetailPx))
  for (let index = 0; index < issuerLines.length; index += 1) {
    textY += L.rhythm.issuerLineMm
    if (index < issuerLines.length - 1) textY += L.rhythm.issuerStackMm
  }

  const identBottom = measureIdentificationBlockHeight(doc, model)
  return Math.max(identBottom, textY - MARGIN_TOP)
}

function measureCustomerHeight(doc: jsPDF, model: BillingDocumentTemplateModel): number {
  const customerWidth = Math.min(L.customer.widthMm, usableWidth(doc))
  let height = sectionLabelHeightMm()
  doc.setFont("helvetica", "bold")
  doc.setFontSize(billingPxToPt(L.type.customerNamePx))
  const nameLines = doc.splitTextToSize(
    pdfSafeText(model.customer.name),
    customerWidth
  ) as string[]
  height +=
    nameLines.length * L.rhythm.customerNameLineMm + L.rhythm.issuerStackMm

  const customerLines = [
    model.customer.documentLabel,
    model.customer.vatConditionLabel,
    model.customer.addressLine,
    model.customer.localityLine,
  ].filter((line): line is string => Boolean(line))

  doc.setFont("helvetica", "normal")
  doc.setFontSize(billingPxToPt(L.type.customerDetailPx))
  for (let index = 0; index < customerLines.length; index += 1) {
    height += L.rhythm.issuerLineMm
    if (index < customerLines.length - 1) height += L.rhythm.issuerStackMm
  }
  return height
}

function measureTableRowHeight(doc: jsPDF, description: string): number {
  const descLines = doc.splitTextToSize(
    pdfSafeText(description),
    tableDescriptionWidth(doc)
  ) as string[]
  return L.table.rowPadMm * 2 + descLines.length * L.table.lineMm
}

function measureTotalsBlockHeight(model: BillingDocumentTemplateModel): number {
  let height = 0
  for (const row of model.totals) {
    if (row.variant === "total") {
      height +=
        L.totals.totalGapMm +
        L.totals.totalGapMm +
        billingPxToMm(L.type.totalPx * 0.8) +
        billingPxToMm(L.type.totalPx * 0.6)
    } else {
      height +=
        billingPxToMm(L.type.totalsPx * 0.8) +
        billingPxToMm(L.type.totalsPx * 0.6) +
        L.rhythm.totalsRowMm
    }
  }
  return height
}

function measureObservationsHeight(
  doc: jsPDF,
  observations: string
): number {
  const width = Math.min(L.observations.widthMm, usableWidth(doc))
  return (
    sectionLabelHeightMm() +
    measureWrappedHeight(
      doc,
      observations,
      width,
      L.rhythm.issuerLineMm
    )
  )
}

function emptySlice(pageIndex: number): BillingDocumentPageSlice {
  return {
    pageIndex,
    showDocumentHeader: false,
    showCustomer: false,
    showTableHeader: false,
    itemIndices: [],
    showTotals: false,
    showObservations: false,
  }
}

export function planBillingDocumentPages(
  model: BillingDocumentTemplateModel,
  options?: { hasLogo?: boolean }
): BillingDocumentPagePlan {
  const doc = createMeasureDoc()
  const contentBottom = billingContentBottomMm()
  const hasLogo = Boolean(
    options?.hasLogo ?? (model.issuer.showLogo && model.issuer.logoUrl)
  )

  const pages: BillingDocumentPageSlice[] = []
  let pageIndex = 0
  let y = MARGIN_TOP

  function currentSlice(): BillingDocumentPageSlice {
    return pages[pageIndex] ?? emptySlice(pageIndex)
  }

  function startPage(slice: Partial<BillingDocumentPageSlice>) {
    const next = emptySlice(pageIndex)
    Object.assign(next, slice)
    pages[pageIndex] = next
  }

  function addPage(slice: Partial<BillingDocumentPageSlice> = {}) {
    pageIndex += 1
    y = MARGIN_TOP
    startPage(slice)
  }

  function ensureSpace(height: number, onNewPage?: Partial<BillingDocumentPageSlice>) {
    if (y + height > contentBottom) {
      addPage(onNewPage ?? {})
    }
  }

  startPage({ showDocumentHeader: true, showCustomer: true })

  const headerHeight =
    measureIssuerBlockHeight(doc, model, hasLogo) + L.header.afterHeaderMm
  y += headerHeight + L.rhythm.afterHairlineMm
  y += measureCustomerHeight(doc, model) + L.rhythm.afterCustomerMm

  y += sectionLabelHeightMm()
  ensureSpace(L.table.headerHeightMm, { showTableHeader: true })
  currentSlice().showTableHeader = true
  y += L.table.headerHeightMm

  for (let index = 0; index < model.items.length; index += 1) {
    const rowHeight = measureTableRowHeight(doc, model.items[index].description)
    if (y + rowHeight > contentBottom) {
      addPage({ showTableHeader: true })
      y = MARGIN_TOP + L.table.headerHeightMm
    }
    currentSlice().itemIndices.push(index)
    y += rowHeight
  }

  y += L.rhythm.afterTableMm
  const totalsHeight = measureTotalsBlockHeight(model)
  ensureSpace(totalsHeight)
  currentSlice().showTotals = true
  y += totalsHeight

  if (model.observations) {
    y += L.rhythm.afterTotalsMm
    const observationsHeight = measureObservationsHeight(doc, model.observations)
    ensureSpace(observationsHeight)
    currentSlice().showObservations = true
    y += observationsHeight
  }

  return {
    pages,
    contentBottomMm: contentBottom,
    innerBottomMm: billingInnerBottomMm(),
  }
}
