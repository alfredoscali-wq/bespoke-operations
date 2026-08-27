import { jsPDF } from "jspdf"

import {
  BILLING_DOCUMENT_QR_RESERVED_LABEL,
  BILLING_DOCUMENT_QR_ZONE_LABEL,
  BILLING_DOCUMENT_TABLE_COLUMNS,
  BILLING_DOCUMENT_VISUAL,
  buildBillingDocumentTemplateModelFromDocument,
  type BillingDocumentTemplateModel,
} from "@/lib/isp/billing-document-template"
import { ISP_BILLING_DOCUMENT_TYPE_LABELS } from "@/lib/isp/billing-constants"
import type { IspBillingDocument } from "@/lib/isp/billing-document-types"
import type { IspBillingTemplateSettings } from "@/lib/isp/billing-template-settings"

const MARGIN = 20
const ACCENT = BILLING_DOCUMENT_VISUAL.accent
const ACCENT_SOFT = BILLING_DOCUMENT_VISUAL.accentSoft
const INK = BILLING_DOCUMENT_VISUAL.ink
const MUTED = BILLING_DOCUMENT_VISUAL.muted
const LINE = BILLING_DOCUMENT_VISUAL.line
const DISCOUNT = BILLING_DOCUMENT_VISUAL.discount
const IDENT_WIDTH = 64
const LOGO_MAX_W = 50
const LOGO_MAX_H = 24
const FOOTER_HEIGHT = 36
const HEADER_GAP = 18

function pageHeight(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight()
}

function contentBottom(doc: jsPDF): number {
  return pageHeight(doc) - MARGIN - FOOTER_HEIGHT - 4
}

function ensureSpace(doc: jsPDF, y: number, height: number): number {
  if (y + height > contentBottom(doc)) {
    doc.addPage()
    return MARGIN + 4
  }
  return y
}

function writeWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = 4.2,
  align: "left" | "right" = "left"
): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[]
  for (const line of lines) {
    y = ensureSpace(doc, y, lineHeight)
    doc.text(line, x, y, align === "right" ? { align: "right" } : undefined)
    y += lineHeight
  }
  return y
}

function tableColumns(pageWidth: number) {
  const usable = pageWidth - MARGIN * 2
  const indexW = 8
  const quantityW = 14
  const unitW = 26
  const discountW = 24
  const taxW = 24
  const amountW = 24
  const descriptionW =
    usable - indexW - quantityW - unitW - discountW - taxW - amountW
  const indexRight = MARGIN + indexW
  const descriptionX = indexRight + 1
  const quantityRight = descriptionX + descriptionW
  const unitRight = quantityRight + unitW
  const discountRight = unitRight + discountW
  const taxRight = discountRight + taxW
  const amountRight = pageWidth - MARGIN
  return {
    indexRight,
    descriptionX,
    descriptionWidth: descriptionW - 2,
    quantityRight,
    unitRight,
    discountRight,
    taxRight,
    amountRight,
  }
}

function drawHairline(
  doc: jsPDF,
  y: number,
  pageWidth: number,
  color: [number, number, number] = LINE
) {
  doc.setDrawColor(...color)
  doc.setLineWidth(0.18)
  doc.line(MARGIN, y, pageWidth - MARGIN, y)
}

function drawSectionLabel(doc: jsPDF, text: string, y: number): number {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(...ACCENT)
  doc.text(text.toUpperCase(), MARGIN, y)
  doc.setTextColor(...INK)
  return y + 5
}

function drawTableHeader(doc: jsPDF, y: number, pageWidth: number): number {
  const cols = tableColumns(pageWidth)
  const height = 7
  doc.setFillColor(...ACCENT_SOFT)
  doc.rect(MARGIN, y - 4.6, pageWidth - MARGIN * 2, height, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.8)
  doc.setTextColor(...MUTED)
  const labels = BILLING_DOCUMENT_TABLE_COLUMNS
  doc.text(labels[0].label, cols.indexRight, y, { align: "right" })
  doc.text(labels[1].label, cols.descriptionX, y)
  doc.text(labels[2].label, cols.quantityRight, y, { align: "right" })
  doc.text(labels[3].label, cols.unitRight, y, { align: "right" })
  doc.text(labels[4].label, cols.discountRight, y, { align: "right" })
  doc.text(labels[5].label, cols.taxRight, y, { align: "right" })
  doc.text(labels[6].label, cols.amountRight, y, { align: "right" })
  doc.setTextColor(...INK)
  return y + 6.5
}

function drawIdentificationBlock(
  doc: jsPDF,
  model: BillingDocumentTemplateModel,
  pageWidth: number,
  y: number
): number {
  const x = pageWidth - MARGIN - IDENT_WIDTH
  const right = pageWidth - MARGIN
  let cursor = y + 4

  const letter = model.identification.letter
  const showKindLabel = letter !== "X"
  const cardWidth = 40
  const cardX = right - cardWidth
  const box = 14
  const letterBox = letter ? box + 2 : 0
  const cardHeight = (showKindLabel ? 10 : 6) + letterBox
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.25)
  doc.rect(cardX, cursor - 4, cardWidth, cardHeight)
  if (showKindLabel) {
    const kindLabel = model.identification.kindLabel
    doc.setFont("helvetica", "bold")
    doc.setFontSize(kindLabel.length > 10 ? 6.4 : 8.5)
    doc.setTextColor(...INK)
    doc.text(kindLabel, cardX + cardWidth / 2, cursor + 1.2, {
      align: "center",
    })
    cursor += 6
  }

  if (letter) {
    const boxX = cardX + (cardWidth - box) / 2
    if (!showKindLabel) cursor += 1
    doc.setFillColor(...ACCENT)
    doc.rect(boxX, cursor, box, box, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(16)
    doc.setTextColor(255, 255, 255)
    doc.text(letter, boxX + box / 2, cursor + 10.1, {
      align: "center",
    })
    cursor += box + 4
  }

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

  doc.setFontSize(8)
  for (const [label, value] of rows) {
    cursor += 5.8
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...MUTED)
    doc.text(label, x, cursor)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...INK)
    const valueLines = doc.splitTextToSize(value, 34) as string[]
    doc.text(valueLines[0] ?? value, right, cursor, { align: "right" })
    for (const extra of valueLines.slice(1)) {
      cursor += 3.8
      doc.text(extra, right, cursor, { align: "right" })
    }
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
    doc.addImage(logoDataUrl, format, x, y, LOGO_MAX_W, LOGO_MAX_H)
    return true
  } catch {
    return false
  }
}

function drawFiscalFooter(doc: jsPDF, model: BillingDocumentTemplateModel) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const top = pageHeight(doc) - MARGIN - FOOTER_HEIGHT
  drawHairline(doc, top, pageWidth)

  const qrSize = 18
  const qrX = pageWidth - MARGIN - qrSize
  const col3 = qrX - 4
  const col2Width = 58
  const col2 = col3 - col2Width
  const legendWidth = col2 - MARGIN - 4
  let y = top + 5

  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.setTextColor(...MUTED)
  if (model.nonFiscalNotice) {
    doc.setFont("helvetica", "bold")
    y = writeFooterWrapped(
      doc,
      model.nonFiscalNotice,
      MARGIN,
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
      MARGIN,
      y,
      legendWidth,
      3.4
    )
  }

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text("CAE:", col2, top + 6)
  doc.setTextColor(...INK)
  doc.setFont("helvetica", model.fiscal.showCae ? "bold" : "normal")
  doc.text(model.fiscal.caeDisplay, col2 + 10, top + 6)
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

  doc.setFontSize(5.5)
  doc.setTextColor(...MUTED)
  const qrCaption = doc.splitTextToSize(
    BILLING_DOCUMENT_QR_RESERVED_LABEL,
    qrSize + 10
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
  doc.setFontSize(5)
  doc.text(BILLING_DOCUMENT_QR_ZONE_LABEL, qrX + qrSize / 2, top + 10 + qrSize / 2, {
    align: "center",
  })
  doc.setTextColor(...INK)
}

function writeIssuerDetail(
  doc: jsPDF,
  text: string,
  y: number,
  maxWidth: number,
  withMark: boolean
): number {
  if (withMark) {
    doc.setFillColor(...ACCENT)
    doc.circle(MARGIN + 0.8, y - 0.9, 0.7, "F")
    return writeWrapped(doc, text, MARGIN + 4, y, maxWidth - 4, 4.2)
  }
  return writeWrapped(doc, text, MARGIN, y, maxWidth, 4.2)
}

function writeFooterWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[]
  for (const line of lines.slice(0, 4)) {
    doc.text(line, x, y)
    y += lineHeight
  }
  return y
}

function renderBillingDocumentPdf(
  model: BillingDocumentTemplateModel,
  options?: { logoDataUrl?: string | null }
): ArrayBuffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const leftWidth = pageWidth - MARGIN * 2 - IDENT_WIDTH - HEADER_GAP
  const logoDataUrl =
    model.issuer.showLogo && model.issuer.logoUrl
      ? (options?.logoDataUrl ?? null)
      : null

  let y = MARGIN + 2
  const identBottom = drawIdentificationBlock(doc, model, pageWidth, y)

  let textY = y + 3
  if (logoDataUrl) {
    let logoX = MARGIN
    if (model.issuer.logoPosition === "center") {
      logoX = MARGIN + Math.max(0, (leftWidth - LOGO_MAX_W) / 2)
    } else if (model.issuer.logoPosition === "right") {
      logoX = MARGIN + Math.max(0, leftWidth - LOGO_MAX_W)
    }
    const logoPlaced = drawLogo(doc, logoDataUrl, logoX, y)
    if (logoPlaced) textY = y + LOGO_MAX_H + 6
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(11.5)
  doc.setTextColor(...INK)
  textY = writeWrapped(doc, model.issuer.legalName, MARGIN, textY, leftWidth, 5)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  if (model.issuer.taxId) {
    textY = writeIssuerDetail(doc, `CUIT ${model.issuer.taxId}`, textY, leftWidth, false)
  }
  if (model.issuer.vatConditionLabel !== "—") {
    textY = writeIssuerDetail(
      doc,
      model.issuer.vatConditionLabel,
      textY,
      leftWidth,
      false
    )
  }
  if (model.issuer.addressLine) {
    textY = writeIssuerDetail(doc, model.issuer.addressLine, textY, leftWidth, true)
  }
  if (model.issuer.localityLine) {
    textY = writeIssuerDetail(doc, model.issuer.localityLine, textY, leftWidth, false)
  }
  if (model.issuer.phone) {
    textY = writeIssuerDetail(doc, model.issuer.phone, textY, leftWidth, true)
  }
  if (model.issuer.email) {
    textY = writeIssuerDetail(doc, model.issuer.email, textY, leftWidth, true)
  }
  if (model.issuer.website) {
    textY = writeIssuerDetail(doc, model.issuer.website, textY, leftWidth, true)
  }

  y = Math.max(identBottom, textY) + 9
  const dividerX = pageWidth - MARGIN - IDENT_WIDTH - HEADER_GAP / 2
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.18)
  doc.line(dividerX, MARGIN, dividerX, y - 4)
  drawHairline(doc, y, pageWidth)
  y += 8

  y = drawSectionLabel(doc, "Cliente", y)
  const contentWidth = pageWidth - MARGIN * 2
  let leftY = y
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10.5)
  doc.setTextColor(...INK)
  leftY = writeWrapped(
    doc,
    model.customer.name,
    MARGIN,
    leftY,
    contentWidth * 0.72,
    5
  )
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  leftY = writeWrapped(
    doc,
    model.customer.documentLabel,
    MARGIN,
    leftY,
    contentWidth * 0.72,
    4.3
  )
  if (model.customer.vatConditionLabel) {
    leftY = writeWrapped(
      doc,
      model.customer.vatConditionLabel,
      MARGIN,
      leftY,
      contentWidth * 0.72,
      4.3
    )
  }
  if (model.customer.addressLine) {
    leftY = writeWrapped(
      doc,
      model.customer.addressLine,
      MARGIN,
      leftY,
      contentWidth * 0.72,
      4.3
    )
  }
  if (model.customer.localityLine) {
    leftY = writeWrapped(
      doc,
      model.customer.localityLine,
      MARGIN,
      leftY,
      contentWidth * 0.72,
      4.3
    )
  }
  y = leftY + 9
  y = drawSectionLabel(doc, "Conceptos", y)
  y = drawTableHeader(doc, y, pageWidth)

  const cols = tableColumns(pageWidth)
  for (const item of model.items) {
    const descLines = doc.splitTextToSize(
      item.description,
      cols.descriptionWidth
    ) as string[]
    const rowHeight = Math.max(5.4, descLines.length * 4)
    if (y + rowHeight + 4 > contentBottom(doc)) {
      doc.addPage()
      y = drawTableHeader(doc, MARGIN + 6, pageWidth)
    }

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(item.indexLabel, cols.indexRight, y, { align: "right" })
    doc.setTextColor(...INK)
    let descY = y
    for (const line of descLines) {
      doc.text(line, cols.descriptionX, descY)
      descY += 4
    }
    doc.setTextColor(...MUTED)
    doc.text(item.quantityLabel, cols.quantityRight, y, { align: "right" })
    doc.text(item.unitPriceLabel, cols.unitRight, y, { align: "right" })
    if (item.hasDiscount) doc.setTextColor(...DISCOUNT)
    doc.text(item.discountLabel, cols.discountRight, y, { align: "right" })
    doc.setTextColor(...MUTED)
    doc.text(item.taxLabel, cols.taxRight, y, { align: "right" })
    doc.setTextColor(...INK)
    doc.setFont("helvetica", "bold")
    doc.text(item.amountLabel, cols.amountRight, y, { align: "right" })
    doc.setFont("helvetica", "normal")
    y = Math.max(descY, y + 5.2)
    drawHairline(doc, y, pageWidth)
    y += 4.6
  }

  y += 8
  const totalsWidth = 62
  const totalsX = pageWidth - MARGIN - totalsWidth
  for (const row of model.totals) {
    y = ensureSpace(doc, y, row.emphasize ? 12 : 6.5)
    if (row.variant === "total") {
      doc.setDrawColor(...ACCENT)
      doc.setLineWidth(0.55)
      doc.line(totalsX, y - 3.6, pageWidth - MARGIN, y - 3.6)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(11.5)
      doc.setTextColor(...ACCENT)
    } else if (row.variant === "discount") {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.setTextColor(...MUTED)
    } else {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.setTextColor(...MUTED)
    }
    doc.text(row.label, totalsX, y)
    if (row.variant === "discount") {
      doc.setTextColor(...DISCOUNT)
    } else if (row.variant !== "total") {
      doc.setTextColor(...INK)
    }
    const amountLabel =
      row.variant === "discount"
        ? row.amountLabel.replaceAll("\u2212", "-")
        : row.amountLabel
    doc.text(amountLabel, pageWidth - MARGIN, y, { align: "right" })
    y += row.emphasize ? 8 : 5.4
  }

  if (model.observations) {
    y = ensureSpace(doc, y + 10, 16)
    y = drawSectionLabel(doc, "Observaciones", y)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(...MUTED)
    y = writeWrapped(doc, model.observations, MARGIN, y, pageWidth - MARGIN * 2)
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
