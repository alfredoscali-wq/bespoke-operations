import { jsPDF } from "jspdf"

import {
  BILLING_DOCUMENT_TABLE_COLUMNS,
  buildBillingDocumentTemplateModelFromDocument,
  type BillingDocumentTemplateModel,
} from "@/lib/isp/billing-document-template"
import { ISP_BILLING_DOCUMENT_TYPE_LABELS } from "@/lib/isp/billing-constants"
import type { IspBillingDocument } from "@/lib/isp/billing-document-types"
import type { IspBillingTemplateSettings } from "@/lib/isp/billing-template-settings"

const MARGIN = 16
const ACCENT: [number, number, number] = [58, 92, 156]
const ACCENT_SOFT: [number, number, number] = [232, 237, 247]
const INK: [number, number, number] = [28, 32, 40]
const MUTED: [number, number, number] = [108, 114, 126]
const LINE: [number, number, number] = [218, 222, 228]
const IDENT_WIDTH = 48
const LOGO_MAX_W = 28
const LOGO_MAX_H = 16

function pageBottom(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight() - MARGIN
}

function ensureSpace(doc: jsPDF, y: number, height: number): number {
  if (y + height > pageBottom(doc)) {
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
  lineHeight = 4.4
): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[]
  for (const line of lines) {
    y = ensureSpace(doc, y, lineHeight)
    doc.text(line, x, y)
    y += lineHeight
  }
  return y
}

function tableColumns(pageWidth: number) {
  const qty = 16
  const unit = 32
  const amount = 32
  const description = pageWidth - MARGIN * 2 - qty - unit - amount
  return {
    qtyX: MARGIN,
    descriptionX: MARGIN + qty,
    unitX: MARGIN + qty + description,
    amountX: pageWidth - MARGIN,
    descriptionWidth: description - 2,
    unitWidth: unit,
    qty,
    unit,
    amount,
  }
}

function drawHairline(
  doc: jsPDF,
  y: number,
  pageWidth: number,
  color: [number, number, number] = LINE
) {
  doc.setDrawColor(...color)
  doc.setLineWidth(0.2)
  doc.line(MARGIN, y, pageWidth - MARGIN, y)
}

function drawSectionLabel(doc: jsPDF, text: string, y: number): number {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(...ACCENT)
  doc.text(text.toUpperCase(), MARGIN, y)
  doc.setTextColor(...INK)
  return y + 3
}

function drawTableHeader(doc: jsPDF, y: number, pageWidth: number): number {
  const cols = tableColumns(pageWidth)
  const height = 7
  doc.setFillColor(...ACCENT_SOFT)
  doc.rect(MARGIN, y - 4.5, pageWidth - MARGIN * 2, height, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(...ACCENT)
  doc.text(BILLING_DOCUMENT_TABLE_COLUMNS[0].label, cols.qtyX, y)
  doc.text(BILLING_DOCUMENT_TABLE_COLUMNS[1].label, cols.descriptionX, y)
  doc.text(BILLING_DOCUMENT_TABLE_COLUMNS[2].label, cols.amountX - cols.unit, y, {
    align: "right",
  })
  doc.text(BILLING_DOCUMENT_TABLE_COLUMNS[3].label, cols.amountX, y, {
    align: "right",
  })
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.25)
  doc.line(MARGIN, y + 2.4, pageWidth - MARGIN, y + 2.4)
  doc.setTextColor(...INK)
  return y + 7
}

function drawIdentificationBox(
  doc: jsPDF,
  model: BillingDocumentTemplateModel,
  pageWidth: number,
  y: number
): number {
  const x = pageWidth - MARGIN - IDENT_WIDTH
  const hasLetter = Boolean(model.identification.letter)
  const height = hasLetter ? 38 : 30
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.35)
  doc.rect(x, y, IDENT_WIDTH, height)

  let cursor = y + (hasLetter ? 12 : 8)
  doc.setTextColor(...ACCENT)
  if (model.identification.letter) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(22)
    doc.text(model.identification.letter, x + IDENT_WIDTH / 2, cursor, {
      align: "center",
    })
    cursor += 8
  }
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(...INK)
  doc.text(model.identification.kindLabel, x + IDENT_WIDTH / 2, cursor, {
    align: "center",
  })
  cursor += 6
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.text(model.identification.numberLabel, x + IDENT_WIDTH / 2, cursor, {
    align: "center",
  })
  cursor += 5
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(model.identification.issueDateLabel, x + IDENT_WIDTH / 2, cursor, {
    align: "center",
  })
  if (model.identification.dueDateLabel) {
    cursor += 4
    doc.setFontSize(7)
    doc.text(
      `Vence ${model.identification.dueDateLabel}`,
      x + IDENT_WIDTH / 2,
      cursor,
      { align: "center" }
    )
  }
  doc.setTextColor(...INK)
  return y + height
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

function renderBillingDocumentPdf(
  model: BillingDocumentTemplateModel,
  options?: { logoDataUrl?: string | null }
): ArrayBuffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const brandWidth = pageWidth - MARGIN * 2 - IDENT_WIDTH - 8
  const logoDataUrl =
    model.issuer.showLogo && model.issuer.logoUrl
      ? (options?.logoDataUrl ?? null)
      : null

  let y = MARGIN + 2
  const identBottom = drawIdentificationBox(doc, model, pageWidth, y)

  let logoPlaced = false
  let textX = MARGIN
  let textY = y + 4
  if (logoDataUrl) {
    if (model.issuer.logoPosition === "center") {
      logoPlaced = drawLogo(
        doc,
        logoDataUrl,
        MARGIN + Math.max(0, (brandWidth - LOGO_MAX_W) / 2),
        y
      )
      if (logoPlaced) textY = y + LOGO_MAX_H + 6
    } else if (model.issuer.logoPosition === "right") {
      logoPlaced = drawLogo(
        doc,
        logoDataUrl,
        MARGIN + brandWidth - LOGO_MAX_W,
        y
      )
    } else {
      logoPlaced = drawLogo(doc, logoDataUrl, MARGIN, y)
      if (logoPlaced) textX = MARGIN + LOGO_MAX_W + 4
    }
  }
  void logoPlaced

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.setTextColor(...INK)
  textY = writeWrapped(
    doc,
    model.issuer.legalName,
    textX,
    textY,
    brandWidth - (textX - MARGIN)
  )
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  const issuerLines = [
    `CUIT ${model.issuer.taxId}${
      model.issuer.vatConditionLabel !== "—"
        ? ` · ${model.issuer.vatConditionLabel}`
        : ""
    }`,
    model.issuer.addressLine,
    model.issuer.localityLine,
    [model.issuer.phone, model.issuer.email].filter(Boolean).join(" · ") || null,
  ].filter((line): line is string => Boolean(line))

  for (const line of issuerLines) {
    textY = writeWrapped(doc, line, textX, textY, brandWidth - (textX - MARGIN), 4)
  }

  y = Math.max(identBottom, textY) + 6
  drawHairline(doc, y, pageWidth, ACCENT)
  y += 8

  y = drawSectionLabel(doc, "Datos del cliente", y)
  drawHairline(doc, y, pageWidth)
  y += 6
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(...INK)
  y = writeWrapped(doc, model.customer.name, MARGIN, y, brandWidth)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  y = writeWrapped(doc, model.customer.documentLabel, MARGIN, y, brandWidth, 4)
  if (model.customer.vatConditionLabel) {
    y = writeWrapped(
      doc,
      model.customer.vatConditionLabel,
      MARGIN,
      y,
      brandWidth,
      4
    )
  }
  if (model.customer.addressLine) {
    y = writeWrapped(doc, model.customer.addressLine, MARGIN, y, brandWidth, 4)
  }
  if (model.customer.localityLine) {
    y = writeWrapped(doc, model.customer.localityLine, MARGIN, y, brandWidth, 4)
  }

  y += 6
  y = drawSectionLabel(doc, "Conceptos", y)
  y = drawTableHeader(doc, y, pageWidth)

  const cols = tableColumns(pageWidth)
  for (const item of model.items) {
    const descLines = doc.splitTextToSize(
      item.description,
      cols.descriptionWidth
    ) as string[]
    const rowHeight = Math.max(5.2, descLines.length * 4.2)
    if (y + rowHeight > pageBottom(doc) - 8) {
      doc.addPage()
      y = MARGIN + 6
      y = drawTableHeader(doc, y, pageWidth)
    }
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(...MUTED)
    doc.text(item.quantityLabel, cols.qtyX, y)
    doc.setTextColor(...INK)
    let descY = y
    for (const line of descLines) {
      doc.text(line, cols.descriptionX, descY)
      descY += 4.2
    }
    doc.setTextColor(...MUTED)
    doc.text(item.unitPriceLabel, cols.amountX - cols.amount, y, {
      align: "right",
    })
    doc.setTextColor(...INK)
    doc.text(item.amountLabel, cols.amountX, y, { align: "right" })
    y = Math.max(descY, y + 5.2)
    drawHairline(doc, y, pageWidth)
    y += 5
  }

  y += 2
  const totalsWidth = 62
  const totalsX = pageWidth - MARGIN - totalsWidth
  for (const row of model.totals) {
    y = ensureSpace(doc, y, row.emphasize ? 10 : 6)
    if (row.emphasize) {
      doc.setDrawColor(...INK)
      doc.setLineWidth(0.35)
      doc.line(totalsX, y - 3, pageWidth - MARGIN, y - 3)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(11)
      doc.setTextColor(...INK)
    } else {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.setTextColor(...MUTED)
    }
    doc.text(row.label, totalsX, y)
    doc.setTextColor(...INK)
    doc.text(row.amountLabel, pageWidth - MARGIN, y, { align: "right" })
    y += row.emphasize ? 8 : 5.5
  }

  if (model.observations) {
    y = ensureSpace(doc, y + 4, 16)
    y = drawSectionLabel(doc, "Observaciones", y)
    drawHairline(doc, y, pageWidth)
    y += 5
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(...MUTED)
    y = writeWrapped(doc, model.observations, MARGIN, y, pageWidth - MARGIN * 2)
  }

  if (model.nonFiscalNotice) {
    y = ensureSpace(doc, y + 8, 12)
    doc.setDrawColor(...INK)
    doc.setLineWidth(0.35)
    doc.rect(MARGIN, y - 4, pageWidth - MARGIN * 2, 10)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8.5)
    doc.setTextColor(...INK)
    doc.text(model.nonFiscalNotice, pageWidth / 2, y + 2, { align: "center" })
    y += 12
  }

  if (model.fiscal.showCae && model.fiscal.cae) {
    y = ensureSpace(doc, y + 6, 14)
    y = drawSectionLabel(doc, "Información fiscal", y)
    drawHairline(doc, y, pageWidth)
    y += 5
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(...MUTED)
    y = writeWrapped(doc, `CAE ${model.fiscal.cae}`, MARGIN, y, pageWidth - MARGIN * 2)
    if (model.fiscal.caeExpiresAtLabel) {
      y = writeWrapped(
        doc,
        `Vto. CAE ${model.fiscal.caeExpiresAtLabel}`,
        MARGIN,
        y,
        pageWidth - MARGIN * 2
      )
    }
  }

  if (model.footerLegend) {
    y = ensureSpace(doc, y + 8, 8)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    y = writeWrapped(
      doc,
      model.footerLegend,
      MARGIN,
      y,
      pageWidth - MARGIN * 2
    )
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
