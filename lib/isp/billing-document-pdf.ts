import { jsPDF } from "jspdf"

import {
  BILLING_DOCUMENT_LAYOUT as L,
  billingPxToMm,
  billingPxToPt,
} from "@/lib/isp/billing-document-layout"
import {
  BILLING_DOCUMENT_QR_RESERVED_LABEL,
  BILLING_DOCUMENT_QR_ZONE_LABEL,
  BILLING_DOCUMENT_TABLE_COLUMNS,
  buildBillingDocumentTemplateModelFromDocument,
  type BillingDocumentTemplateModel,
} from "@/lib/isp/billing-document-template"
import { ISP_BILLING_DOCUMENT_TYPE_LABELS } from "@/lib/isp/billing-constants"
import type { IspBillingDocument } from "@/lib/isp/billing-document-types"
import type { IspBillingTemplateSettings } from "@/lib/isp/billing-template-settings"

const ACCENT = L.colors.accent
const ACCENT_SOFT = L.colors.accentSoft
const INK = L.colors.ink
const MUTED = L.colors.muted
const LINE = L.colors.line
const DISCOUNT = L.colors.discount
const MARGIN_X: number = L.margin.xMm
const MARGIN_TOP: number = L.margin.topMm
const MARGIN_BOTTOM: number = L.margin.bottomMm

function pageWidth(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth()
}

function pageHeight(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight()
}

function contentBottom(doc: jsPDF): number {
  return pageHeight(doc) - MARGIN_BOTTOM - L.footer.heightMm
}

function ensureSpace(doc: jsPDF, y: number, height: number): number {
  if (y + height > contentBottom(doc)) {
    doc.addPage()
    return MARGIN_TOP + 4
  }
  return y
}

function pdfSafeText(text: string): string {
  return text.replaceAll("\u2212", "-")
}

function writeWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  align: "left" | "right" = "left"
): number {
  const lines = doc.splitTextToSize(pdfSafeText(text), maxWidth) as string[]
  for (const line of lines) {
    y = ensureSpace(doc, y, lineHeight)
    doc.text(line, x, y, align === "right" ? { align: "right" } : undefined)
    y += lineHeight
  }
  return y
}

function usableWidth(doc: jsPDF): number {
  return pageWidth(doc) - MARGIN_X * 2
}

function tableColumns(doc: jsPDF) {
  const usable = usableWidth(doc)
  const widths = L.table.columns.map((percent) => (usable * percent) / 100)
  let cursor = MARGIN_X
  const cols = widths.map((width) => {
    const start = cursor
    cursor += width
    return { start, end: cursor, width }
  })
  const pad = 2.2
  return {
    indexRight: cols[0].end - 1.2,
    descriptionX: cols[1].start + pad,
    descriptionWidth: cols[1].width - pad * 2,
    quantityRight: cols[2].end - pad,
    unitRight: cols[3].end - pad,
    discountRight: cols[4].end - pad,
    taxRight: cols[5].end - pad,
    amountRight: cols[6].end - pad,
  }
}

function drawHairline(doc: jsPDF, y: number) {
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.18)
  doc.line(MARGIN_X, y, pageWidth(doc) - MARGIN_X, y)
}

function drawSectionLabel(doc: jsPDF, text: string, y: number): number {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(billingPxToPt(L.type.sectionLabelPx))
  doc.setTextColor(...ACCENT)
  doc.text(text.toUpperCase(), MARGIN_X, y)
  doc.setTextColor(...INK)
  return (
    y +
    billingPxToMm(L.type.sectionLabelPx * 1.375) +
    L.rhythm.afterSectionLabelMm
  )
}

function writeStack(
  doc: jsPDF,
  lines: string[],
  x: number,
  y: number,
  maxWidth: number,
  lineMm: number,
  stackMm: number
): number {
  lines.forEach((line, index) => {
    y = writeWrapped(doc, line, x, y, maxWidth, lineMm)
    if (index < lines.length - 1) y += stackMm
  })
  return y
}

function drawTableHeader(doc: jsPDF, y: number): number {
  const cols = tableColumns(doc)
  const height = L.table.headerHeightMm
  doc.setFillColor(...ACCENT_SOFT)
  doc.rect(MARGIN_X, y, usableWidth(doc), height, "F")
  const textY = y + height * 0.68
  doc.setFont("helvetica", "bold")
  doc.setFontSize(billingPxToPt(L.type.tablePx))
  doc.setTextColor(...MUTED)
  const labels = BILLING_DOCUMENT_TABLE_COLUMNS
  doc.text(labels[0].label, cols.indexRight, textY, { align: "right" })
  doc.text(labels[1].label, cols.descriptionX, textY)
  doc.text(labels[2].label, cols.quantityRight, textY, { align: "right" })
  doc.text(labels[3].label, cols.unitRight, textY, { align: "right" })
  doc.text(labels[4].label, cols.discountRight, textY, { align: "right" })
  doc.text(labels[5].label, cols.taxRight, textY, { align: "right" })
  doc.text(labels[6].label, cols.amountRight, textY, { align: "right" })
  doc.setTextColor(...INK)
  return y + height
}

function identWidth(doc: jsPDF): number {
  return Math.min(
    L.header.identWidthMm,
    (usableWidth(doc) * L.header.identMaxPercent) / 100
  )
}

function identLeft(doc: jsPDF): number {
  return pageWidth(doc) - MARGIN_X - identWidth(doc)
}

function rasterSizeFromDataUrl(
  dataUrl: string
): { width: number; height: number } | null {
  const comma = dataUrl.indexOf(",")
  if (comma < 0) return null
  const binary = Buffer.from(dataUrl.slice(comma + 1), "base64")
  if (binary.length < 24) return null
  if (binary[0] === 0x89 && binary[1] === 0x50) {
    return {
      width: binary.readUInt32BE(16),
      height: binary.readUInt32BE(20),
    }
  }
  if (binary[0] === 0xff && binary[1] === 0xd8) {
    let i = 2
    while (i + 9 < binary.length) {
      if (binary[i] !== 0xff) break
      const marker = binary[i + 1]
      const size = binary.readUInt16BE(i + 2)
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        return {
          height: binary.readUInt16BE(i + 5),
          width: binary.readUInt16BE(i + 7),
        }
      }
      i += 2 + size
    }
  }
  return null
}

function logoDrawSize(dataUrl: string): { widthMm: number; heightMm: number } {
  const boxW = L.logo.maxWidthMm
  const boxH = L.logo.heightMm
  const natural = rasterSizeFromDataUrl(dataUrl)
  if (!natural || natural.width < 1 || natural.height < 1) {
    return { widthMm: boxW, heightMm: boxH }
  }
  const aspect = natural.width / natural.height
  let heightMm = boxH
  let widthMm = heightMm * aspect
  if (widthMm > boxW) {
    widthMm = boxW
    heightMm = widthMm / aspect
  }
  return { widthMm, heightMm }
}

function drawIdentificationBlock(
  doc: jsPDF,
  model: BillingDocumentTemplateModel,
  y: number
): number {
  const right = pageWidth(doc) - MARGIN_X
  const contentLeft = identLeft(doc) + L.header.identPadLeftMm
  const letter = model.identification.letter
  const showKindLabel = letter !== "X"
  const kindLabel = model.identification.kindLabel
  const cardWidth = L.header.cardWidthMm
  const cardX = right - cardWidth
  const box = L.header.letterSizeMm
  const kindPx = kindLabel.length > 10 ? 9 : L.type.identKindPx
  const kindLineMm = billingPxToMm(kindPx * 1.375)
  const cardHeight =
    L.header.cardPadYMm +
    (showKindLabel ? kindLineMm : 0) +
    (showKindLabel && letter ? L.header.kindToLetterMm : 0) +
    (letter ? box : 0) +
    L.header.cardPadYMm

  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.25)
  doc.rect(cardX, y, cardWidth, cardHeight)

  let innerY = y + L.header.cardPadYMm
  if (showKindLabel) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(billingPxToPt(kindPx))
    doc.setTextColor(...INK)
    doc.text(kindLabel, cardX + cardWidth / 2, innerY + kindLineMm * 0.75, {
      align: "center",
    })
    innerY += kindLineMm
    if (letter) innerY += L.header.kindToLetterMm
  }

  if (letter) {
    const boxX = cardX + (cardWidth - box) / 2
    doc.setFillColor(...ACCENT)
    doc.rect(boxX, innerY, box, box, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(billingPxToPt(L.header.letterFontPx))
    doc.setTextColor(255, 255, 255)
    doc.text(letter, boxX + box / 2, innerY + box * 0.72, {
      align: "center",
    })
    innerY += box
  }

  let cursor = y + cardHeight + L.header.afterCardMm
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

  const metaLineMm = billingPxToMm(L.type.identMetaValuePx * 1.375)
  const identInner = right - contentLeft
  const usable = Math.max(24, identInner - L.header.metaGapMm)
  const valueWidth = (usable * L.header.metaValuePercent) / 100
  const labelWidth = (usable * L.header.metaLabelPercent) / 100
  for (const [label, value] of rows) {
    const labelLines = doc.splitTextToSize(
      pdfSafeText(label),
      labelWidth
    ) as string[]
    const valueLines = doc.splitTextToSize(
      pdfSafeText(value),
      valueWidth
    ) as string[]
    const lineCount = Math.max(labelLines.length, valueLines.length, 1)
    for (let index = 0; index < lineCount; index += 1) {
      const labelLine = labelLines[index]
      const valueLine = valueLines[index]
      if (labelLine) {
        doc.setFont("helvetica", "normal")
        doc.setFontSize(billingPxToPt(L.type.identMetaLabelPx))
        doc.setTextColor(...MUTED)
        doc.text(labelLine, contentLeft, cursor)
      }
      if (valueLine) {
        doc.setFont("helvetica", "bold")
        doc.setFontSize(billingPxToPt(L.type.identMetaValuePx))
        doc.setTextColor(...INK)
        doc.text(valueLine, right, cursor, { align: "right" })
      }
      cursor += metaLineMm
    }
    cursor += L.header.metaRowMm
  }

  doc.setTextColor(...INK)
  return cursor
}

function drawLogo(
  doc: jsPDF,
  logoDataUrl: string,
  x: number,
  y: number
): boolean {
  try {
    const format = /image\/jpe?g/i.test(logoDataUrl) ? "JPEG" : "PNG"
    const size = logoDrawSize(logoDataUrl)
    const drawY = y + (L.logo.heightMm - size.heightMm) / 2
    doc.addImage(
      logoDataUrl,
      format,
      x,
      drawY,
      size.widthMm,
      size.heightMm
    )
    return true
  } catch {
    return false
  }
}

function writeFooterWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const lines = doc.splitTextToSize(pdfSafeText(text), maxWidth) as string[]
  for (const line of lines.slice(0, 4)) {
    doc.text(line, x, y)
    y += lineHeight
  }
  return y
}

function drawFiscalFooter(doc: jsPDF, model: BillingDocumentTemplateModel) {
  const width = pageWidth(doc)
  const top = pageHeight(doc) - MARGIN_BOTTOM - L.footer.heightMm
  drawHairline(doc, top)

  const qrSize = L.footer.qrSizeMm
  const qrX = width - MARGIN_X - qrSize
  const col2Width = L.footer.caeWidthMm
  const col2 = qrX - L.footer.columnGapMm - col2Width
  const legendWidth = Math.max(24, col2 - MARGIN_X - L.footer.columnGapMm)
  let y = top + L.rhythm.footerPadTopMm

  doc.setFont("helvetica", "normal")
  doc.setFontSize(billingPxToPt(L.type.footerLegendPx))
  doc.setTextColor(...MUTED)
  if (model.nonFiscalNotice) {
    doc.setFont("helvetica", "bold")
    y = writeFooterWrapped(
      doc,
      model.nonFiscalNotice,
      MARGIN_X,
      y,
      legendWidth,
      3.4
    )
    doc.setFont("helvetica", "normal")
  }
  if (model.footerLegend) {
    y = writeFooterWrapped(
      doc,
      model.footerLegend,
      MARGIN_X,
      y,
      legendWidth,
      3.4
    )
  }

  doc.setFont("helvetica", "normal")
  doc.setFontSize(billingPxToPt(L.type.caePx))
  doc.setTextColor(...MUTED)
  doc.text("CAE:", col2, top + 6)
  doc.setTextColor(...INK)
  doc.setFont("helvetica", model.fiscal.showCae ? "bold" : "normal")
  doc.text(pdfSafeText(model.fiscal.caeDisplay), col2 + 10, top + 6)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...MUTED)
  const caeDue = doc.splitTextToSize(
    `Fecha de vencimiento CAE: ${model.fiscal.caeExpiresDisplay}`,
    col2Width
  ) as string[]
  let caeY = top + 11
  for (const line of caeDue) {
    doc.text(line, col2, caeY)
    caeY += 3.4
  }

  doc.setFontSize(billingPxToPt(L.type.qrCaptionPx))
  doc.setTextColor(...MUTED)
  const qrCaption = doc.splitTextToSize(
    BILLING_DOCUMENT_QR_RESERVED_LABEL,
    qrSize + 8
  ) as string[]
  let captionY = top + 4.5
  for (const line of qrCaption.slice(0, 2)) {
    doc.text(line, qrX + qrSize / 2, captionY, { align: "center" })
    captionY += 2.6
  }
  doc.setDrawColor(...LINE)
  doc.setLineDashPattern([1, 1], 0)
  doc.rect(qrX, top + 10, qrSize, qrSize)
  doc.setLineDashPattern([], 0)
  doc.setFontSize(billingPxToPt(L.type.qrCaptionPx))
  doc.text(BILLING_DOCUMENT_QR_ZONE_LABEL, qrX + qrSize / 2, top + 10 + qrSize / 2, {
    align: "center",
  })
  doc.setTextColor(...INK)
}

function renderBillingDocumentPdf(
  model: BillingDocumentTemplateModel,
  options?: { logoDataUrl?: string | null }
): ArrayBuffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const width = pageWidth(doc)
  const identX = identLeft(doc)
  const leftWidth = identX - MARGIN_X - L.header.columnGapMm
  const logoDataUrl =
    model.issuer.showLogo && model.issuer.logoUrl
      ? (options?.logoDataUrl ?? null)
      : null

  let y: number = MARGIN_TOP
  const identBottom = drawIdentificationBlock(doc, model, y)

  const nameAscent = billingPxToMm(L.type.issuerNamePx * 0.8)
  let textY = y + nameAscent
  if (logoDataUrl) {
    const drawW = logoDrawSize(logoDataUrl).widthMm
    let logoX = MARGIN_X
    if (model.issuer.logoPosition === "center") {
      logoX = MARGIN_X + Math.max(0, (leftWidth - drawW) / 2)
    } else if (model.issuer.logoPosition === "right") {
      logoX = MARGIN_X + Math.max(0, leftWidth - drawW)
    }
    const logoPlaced = drawLogo(doc, logoDataUrl, logoX, y)
    if (logoPlaced) {
      textY = y + L.logo.heightMm + L.logo.gapBelowMm + nameAscent
    }
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(billingPxToPt(L.type.issuerNamePx))
  doc.setTextColor(...INK)
  textY = writeWrapped(
    doc,
    model.issuer.legalName,
    MARGIN_X,
    textY,
    leftWidth,
    L.rhythm.issuerNameLineMm
  )
  textY += L.rhythm.issuerStackMm

  doc.setFont("helvetica", "normal")
  doc.setFontSize(billingPxToPt(L.type.issuerDetailPx))
  doc.setTextColor(...MUTED)
  const issuerLines = [
    model.issuer.taxId ? `CUIT ${model.issuer.taxId}` : null,
    model.issuer.vatConditionLabel !== "—"
      ? model.issuer.vatConditionLabel
      : null,
    model.issuer.addressLine,
    model.issuer.localityLine,
    model.issuer.phone,
    model.issuer.email,
    model.issuer.website,
  ].filter((line): line is string => Boolean(line))

  textY = writeStack(
    doc,
    issuerLines,
    MARGIN_X,
    textY,
    leftWidth,
    L.rhythm.issuerLineMm,
    L.rhythm.issuerStackMm
  )

  y = Math.max(identBottom, textY)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.18)
  doc.line(identX, MARGIN_TOP, identX, y)
  y += L.header.afterHeaderMm
  drawHairline(doc, y)
  y += L.rhythm.afterHairlineMm

  y = drawSectionLabel(doc, "Cliente", y)
  const customerWidth = Math.min(L.customer.widthMm, usableWidth(doc))
  doc.setFont("helvetica", "bold")
  doc.setFontSize(billingPxToPt(L.type.customerNamePx))
  doc.setTextColor(...INK)
  y = writeWrapped(
    doc,
    model.customer.name,
    MARGIN_X,
    y,
    customerWidth,
    L.rhythm.customerNameLineMm
  )
  y += L.rhythm.issuerStackMm
  doc.setFont("helvetica", "normal")
  doc.setFontSize(billingPxToPt(L.type.customerDetailPx))
  doc.setTextColor(...MUTED)
  const customerLines = [
    model.customer.documentLabel,
    model.customer.vatConditionLabel,
    model.customer.addressLine,
    model.customer.localityLine,
  ].filter((line): line is string => Boolean(line))
  y = writeStack(
    doc,
    customerLines,
    MARGIN_X,
    y,
    customerWidth,
    L.rhythm.issuerLineMm,
    L.rhythm.issuerStackMm
  )

  y += L.rhythm.afterCustomerMm
  y = drawSectionLabel(doc, "Conceptos", y)
  y = drawTableHeader(doc, y)

  const cols = tableColumns(doc)
  const tableFont = billingPxToPt(L.type.tablePx)
  const tableAscent = billingPxToMm(L.type.tablePx * 0.8)
  for (const item of model.items) {
    const descLines = doc.splitTextToSize(
      pdfSafeText(item.description),
      cols.descriptionWidth
    ) as string[]
    const rowHeight =
      L.table.rowPadMm * 2 + descLines.length * L.table.lineMm
    if (y + rowHeight > contentBottom(doc)) {
      doc.addPage()
      y = drawTableHeader(doc, MARGIN_TOP)
    }

    const rowTextY = y + L.table.rowPadMm + tableAscent
    doc.setFont("helvetica", "normal")
    doc.setFontSize(tableFont)
    doc.setTextColor(...MUTED)
    doc.text(item.indexLabel, cols.indexRight, rowTextY, { align: "right" })
    doc.setTextColor(...INK)
    let descY = rowTextY
    for (const line of descLines) {
      doc.text(line, cols.descriptionX, descY)
      descY += L.table.lineMm
    }
    doc.setTextColor(...MUTED)
    doc.text(item.quantityLabel, cols.quantityRight, rowTextY, { align: "right" })
    doc.text(item.unitPriceLabel, cols.unitRight, rowTextY, { align: "right" })
    if (item.hasDiscount) doc.setTextColor(...DISCOUNT)
    doc.text(pdfSafeText(item.discountLabel), cols.discountRight, rowTextY, {
      align: "right",
    })
    doc.setTextColor(...MUTED)
    doc.text(pdfSafeText(item.taxLabel), cols.taxRight, rowTextY, {
      align: "right",
    })
    doc.setTextColor(...INK)
    doc.setFont("helvetica", "bold")
    doc.text(pdfSafeText(item.amountLabel), cols.amountRight, rowTextY, {
      align: "right",
    })
    doc.setFont("helvetica", "normal")
    y += rowHeight
    drawHairline(doc, y)
  }

  y += L.rhythm.afterTableMm
  const totalsWidth = L.totals.widthMm
  const totalsX = width - MARGIN_X - totalsWidth
  for (const row of model.totals) {
    if (row.variant === "total") {
      y += L.totals.totalGapMm
      y = ensureSpace(doc, y, L.totals.totalGapMm + 8)
      doc.setDrawColor(...ACCENT)
      doc.setLineWidth(billingPxToMm(2))
      doc.line(totalsX, y, width - MARGIN_X, y)
      y += L.totals.totalGapMm + billingPxToMm(L.type.totalPx * 0.8)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(billingPxToPt(L.type.totalPx))
      doc.setTextColor(...ACCENT)
    } else {
      y = ensureSpace(doc, y, L.rhythm.totalsRowMm + 4)
      y += billingPxToMm(L.type.totalsPx * 0.8)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(billingPxToPt(L.type.totalsPx))
      doc.setTextColor(...MUTED)
    }
    doc.text(row.label, totalsX, y)
    if (row.variant === "discount") {
      doc.setTextColor(...DISCOUNT)
    } else if (row.variant !== "total") {
      doc.setTextColor(...INK)
    }
    doc.text(pdfSafeText(row.amountLabel), width - MARGIN_X, y, {
      align: "right",
    })
    if (row.variant === "total") {
      y += billingPxToMm(L.type.totalPx * 0.6)
    } else {
      y += billingPxToMm(L.type.totalsPx * 0.6) + L.rhythm.totalsRowMm
    }
  }

  if (model.observations) {
    y = ensureSpace(doc, y + L.rhythm.afterTotalsMm, 16)
    y = drawSectionLabel(doc, "Observaciones", y)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(billingPxToPt(L.type.observationsPx))
    doc.setTextColor(...MUTED)
    y = writeWrapped(
      doc,
      model.observations,
      MARGIN_X,
      y,
      Math.min(L.observations.widthMm, usableWidth(doc)),
      L.rhythm.issuerLineMm
    )
  }

  if (y > contentBottom(doc) - 2) {
    doc.addPage()
  }
  const totalPages = doc.getNumberOfPages()
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page)
    drawFiscalFooter(doc, model)
  }

  return doc.output("arraybuffer")
}

export function billingDocumentPdfFileName(document: IspBillingDocument): string {
  const type = ISP_BILLING_DOCUMENT_TYPE_LABELS[document.documentType].replace(
    /\s+/g,
    "-"
  )
  const number = document.formattedNumber ?? "borrador"
  return `${type}-${number}.pdf`
}

export async function loadBillingLogoDataUrl(
  logoUrl: string | null | undefined
): Promise<string | null> {
  const url = logoUrl?.trim() ?? ""
  if (!url) return null
  if (url.startsWith("data:image/")) return url
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const mime = response.headers.get("content-type") ?? ""
    if (!mime.startsWith("image/")) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    return `data:${mime};base64,${bytes.toString("base64")}`
  } catch {
    return null
  }
}

export function buildBillingDocumentPdf(
  document: IspBillingDocument,
  options?: {
    logoDataUrl?: string | null
    templateSettings?: IspBillingTemplateSettings | null
  }
): ArrayBuffer {
  // Fiscal identity always comes from the document snapshot
  // (customerNameSnapshot / issuerLegalNameSnapshot), never live customers.
  const model = buildBillingDocumentTemplateModelFromDocument(
    document,
    options?.templateSettings
  )
  return renderBillingDocumentPdf(model, { logoDataUrl: options?.logoDataUrl })
}

export function buildBillingDocumentPdfFromModel(
  model: BillingDocumentTemplateModel,
  options?: { logoDataUrl?: string | null }
): ArrayBuffer {
  return renderBillingDocumentPdf(model, options)
}
