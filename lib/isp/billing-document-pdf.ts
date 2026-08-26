import { jsPDF } from "jspdf"

import {
  ISP_BILLING_DOCUMENT_ARCA_PENDING,
  ISP_BILLING_DOCUMENT_NON_FISCAL_NOTICE,
  ISP_BILLING_DOCUMENT_TYPE_LABELS,
} from "@/lib/isp/billing-constants"
import { formatCuit, isFiscalBillingDocument } from "@/lib/isp/billing-integrity"
import {
  formatBillingMoney,
  vatConditionLabel,
} from "@/lib/isp/billing-document-integrity"
import type { IspBillingDocument } from "@/lib/isp/billing-document-types"
import { formatDateOnly } from "@/lib/dates/date-only"

const MARGIN = 14
const LINE = 5.5

function pageBottom(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight() - MARGIN
}

function ensureSpace(doc: jsPDF, y: number, height: number): number {
  if (y + height > pageBottom(doc)) {
    doc.addPage()
    return MARGIN + 6
  }
  return y
}

function writeWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number
): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[]
  for (const line of lines) {
    y = ensureSpace(doc, y, LINE)
    doc.text(line, x, y)
    y += LINE
  }
  return y
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
  options?: { logoDataUrl?: string | null }
): ArrayBuffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const width = doc.internal.pageSize.getWidth()
  let y = 18
  let textX = MARGIN
  const logoDataUrl = options?.logoDataUrl ?? null

  if (logoDataUrl) {
    try {
      const format = /image\/jpe?g/i.test(logoDataUrl) ? "JPEG" : "PNG"
      doc.addImage(logoDataUrl, format, MARGIN, 10, 22, 16)
      textX = MARGIN + 26
    } catch {
      textX = MARGIN
    }
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text(document.issuerLegalNameSnapshot || "Empresa facturadora", textX, y)
  y += 7
  if (logoDataUrl && textX !== MARGIN) {
    y = Math.max(y, 30)
  }

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  y = writeWrapped(
    doc,
    [
      `CUIT ${formatCuit(document.issuerTaxIdSnapshot) || "—"}`,
      vatConditionLabel(document.issuerVatConditionSnapshot),
      [
        document.issuerTaxAddressSnapshot,
        document.issuerCitySnapshot,
        document.issuerProvinceSnapshot,
        document.issuerPostalCodeSnapshot,
      ]
        .filter(Boolean)
        .join(" · "),
    ]
      .filter(Boolean)
      .join(" · "),
    MARGIN,
    y,
    width - MARGIN * 2
  )

  y += 3
  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.text(ISP_BILLING_DOCUMENT_TYPE_LABELS[document.documentType], MARGIN, y)
  doc.text(document.formattedNumber ?? "Sin número", width - MARGIN, y, {
    align: "right",
  })
  y += 7

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text(`Fecha: ${formatDateOnly(document.issueDate, { locale: "es-AR" })}`, MARGIN, y)
  if (document.dueDate) {
    doc.text(
      `Vencimiento: ${formatDateOnly(document.dueDate, { locale: "es-AR" })}`,
      width - MARGIN,
      y,
      { align: "right" }
    )
  }
  y += 6
  doc.text(
    `Punto de venta: ${String(document.pointOfSaleNumber).padStart(4, "0")}`,
    MARGIN,
    y
  )
  y += 8

  doc.setFont("helvetica", "bold")
  doc.text("Cliente", MARGIN, y)
  y += 6
  doc.setFont("helvetica", "normal")
  y = writeWrapped(doc, document.customerNameSnapshot, MARGIN, y, width - MARGIN * 2)
  y = writeWrapped(
    doc,
    [
      document.customerDocumentTypeSnapshot.toUpperCase(),
      document.customerDocumentNumberSnapshot || document.customerTaxIdSnapshot || "—",
      document.customerEmailSnapshot,
    ]
      .filter(Boolean)
      .join(" · "),
    MARGIN,
    y,
    width - MARGIN * 2
  )
  y = writeWrapped(
    doc,
    [
      document.customerTaxAddressSnapshot,
      document.customerCitySnapshot,
      document.customerProvinceSnapshot,
      document.customerPostalCodeSnapshot,
    ]
      .filter(Boolean)
      .join(" · ") || "—",
    MARGIN,
    y,
    width - MARGIN * 2
  )

  y += 4
  doc.setDrawColor(200)
  doc.line(MARGIN, y, width - MARGIN, y)
  y += 7

  doc.setFont("helvetica", "bold")
  doc.text("Descripción", MARGIN, y)
  doc.text("Cant.", 118, y)
  doc.text("P. unit.", 140, y)
  doc.text("Importe", width - MARGIN, y, { align: "right" })
  y += 6
  doc.setFont("helvetica", "normal")

  for (const item of document.items) {
    y = ensureSpace(doc, y, LINE * 2)
    const nextY = writeWrapped(doc, item.description, MARGIN, y, 95)
    doc.text(String(item.quantity), 118, y)
    doc.text(formatBillingMoney(item.unitPrice), 140, y)
    doc.text(formatBillingMoney(item.lineTotal), width - MARGIN, y, {
      align: "right",
    })
    y = Math.max(nextY, y + LINE)
  }

  y += 4
  doc.line(MARGIN, y, width - MARGIN, y)
  y += 8
  const totals = [
    ["Subtotal", document.subtotal],
    ["Descuentos", document.discountTotal],
    ["Impuestos", document.taxTotal],
    ["Total", document.total],
  ] as const
  for (const [label, amount] of totals) {
    doc.setFont("helvetica", label === "Total" ? "bold" : "normal")
    doc.text(label, 140, y)
    doc.text(formatBillingMoney(amount), width - MARGIN, y, { align: "right" })
    y += 6
  }

  if (document.observations.trim()) {
    y += 4
    doc.setFont("helvetica", "bold")
    doc.text("Observaciones", MARGIN, y)
    y += 6
    doc.setFont("helvetica", "normal")
    y = writeWrapped(doc, document.observations, MARGIN, y, width - MARGIN * 2)
  }

  y += 8
  doc.setFont("helvetica", "bold")
  if (!isFiscalBillingDocument(document.documentType)) {
    y = writeWrapped(
      doc,
      ISP_BILLING_DOCUMENT_NON_FISCAL_NOTICE,
      MARGIN,
      y,
      width - MARGIN * 2
    )
  } else {
    y = writeWrapped(
      doc,
      ISP_BILLING_DOCUMENT_ARCA_PENDING,
      MARGIN,
      y,
      width - MARGIN * 2
    )
  }

  if (document.cae) {
    throw new Error("El PDF no puede afirmar un CAE en ISP 1.6B.")
  }

  return doc.output("arraybuffer")
}
