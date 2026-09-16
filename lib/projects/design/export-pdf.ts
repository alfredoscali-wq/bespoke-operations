import { jsPDF } from "jspdf"

import { BESPOKE_LOGO_SRC } from "@/lib/branding/logo"
import { projectDesignColorToRgb } from "@/lib/projects/design/colors"
import { renderProjectDesignMapForPdf } from "@/lib/projects/design/export-map"
import {
  buildProjectDesignExportModel,
  type ProjectDesignExportModel,
} from "@/lib/projects/design/export-model"
import type { ProjectDesignExportOptions } from "@/lib/projects/design/export-options"
import type { ProjectDesignSnapshot } from "@/lib/types/project-design"
import type { Project } from "@/lib/types/projects"

const MARGIN = 12
const FOOTER_H = 10
const BRAND = { r: 15, g: 23, b: 42 }
const ACCENT = { r: 30, g: 77, b: 140 }
const MUTED = { r: 100, g: 116, b: 139 }
const LINE = { r: 203, g: 213, b: 225 }
const HEADER_FILL = { r: 241, g: 245, b: 249 }

function pageWidth(doc: jsPDF): number {
  return doc.internal.pageSize.getWidth()
}

function pageHeight(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight()
}

function contentBottom(doc: jsPDF): number {
  return pageHeight(doc) - MARGIN - FOOTER_H
}

function usableWidth(doc: jsPDF): number {
  return pageWidth(doc) - MARGIN * 2
}

function pdfSafe(text: string): string {
  return text.replaceAll("\u2212", "-")
}

function ensureSpace(
  doc: jsPDF,
  model: ProjectDesignExportModel,
  y: number,
  height: number
): number {
  if (y + height <= contentBottom(doc)) {
    return y
  }
  doc.addPage()
  return drawMiniHeader(doc, model)
}

function drawMiniHeader(doc: jsPDF, model: ProjectDesignExportModel): number {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b)
  doc.text("BESPOKE · Diseño de Obra", MARGIN, MARGIN + 4)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  doc.text(
    `${model.header.code} · ${model.header.name}`,
    pageWidth(doc) - MARGIN,
    MARGIN + 4,
    { align: "right" }
  )
  doc.setDrawColor(LINE.r, LINE.g, LINE.b)
  doc.setLineWidth(0.2)
  doc.line(MARGIN, MARGIN + 7, pageWidth(doc) - MARGIN, MARGIN + 7)
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
  return MARGIN + 14
}

function writeWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const lines = doc.splitTextToSize(pdfSafe(text), maxWidth) as string[]
  for (const line of lines) {
    doc.text(line, x, y)
    y += lineHeight
  }
  return y
}

async function loadExportLogoDataUrl(): Promise<string | null> {
  if (typeof fetch === "undefined") {
    return null
  }
  try {
    const response = await fetch(BESPOKE_LOGO_SRC)
    if (!response.ok) {
      return null
    }
    const blob = await response.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function drawFullHeader(
  doc: jsPDF,
  model: ProjectDesignExportModel,
  logoDataUrl: string | null
): number {
  let y = MARGIN
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", MARGIN, y, 18, 18)
    } catch {
      logoDataUrl = null
    }
  }

  const textX = logoDataUrl ? MARGIN + 22 : MARGIN
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b)
  doc.text(model.header.brand, textX, y + 7)
  doc.setFontSize(11)
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
  doc.text(model.header.title, textX, y + 14)

  y += 24
  const colW = usableWidth(doc) / 2
  const rows: Array<[string, string]> = [
    ["Código de Obra", model.header.code],
    ["Nombre", model.header.name],
    ["Estado", model.header.status],
  ]
  if (model.header.location) {
    rows.push(["Localidad", model.header.location])
  }
  rows.push(
    ["Fecha de exportación", model.header.exportedAt],
    ["Sistema de coordenadas", model.header.crs]
  )

  doc.setFontSize(8)
  const rowH = 5.4
  rows.forEach((row, index) => {
    const col = index % 2
    const line = Math.floor(index / 2)
    const x = MARGIN + col * colW
    const rowY = y + line * rowH
    doc.setFont("helvetica", "bold")
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text(`${row[0]}:`, x, rowY)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
    doc.text(pdfSafe(row[1]), x + 38, rowY)
  })

  y += Math.ceil(rows.length / 2) * rowH + 4
  doc.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b)
  doc.setLineWidth(0.5)
  doc.line(MARGIN, y, pageWidth(doc) - MARGIN, y)
  return y + 6
}

function drawSectionTitle(
  doc: jsPDF,
  model: ProjectDesignExportModel,
  title: string,
  y: number
): number {
  y = ensureSpace(doc, model, y, 10)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b)
  doc.text(title.toUpperCase(), MARGIN, y)
  doc.setDrawColor(LINE.r, LINE.g, LINE.b)
  doc.setLineWidth(0.2)
  doc.line(MARGIN, y + 1.6, pageWidth(doc) - MARGIN, y + 1.6)
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
  return y + 7
}

function drawEmptyState(
  doc: jsPDF,
  model: ProjectDesignExportModel,
  y: number
): number {
  y = ensureSpace(doc, model, y, 8)
  doc.setFont("helvetica", "italic")
  doc.setFontSize(9)
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  doc.text("Sin elementos cargados", MARGIN, y)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
  return y + 7
}

function drawKeyValueTable(
  doc: jsPDF,
  model: ProjectDesignExportModel,
  rows: Array<{ label: string; value: string }>,
  y: number
): number {
  const rowH = 6.2
  const labelW = 72
  for (const row of rows) {
    y = ensureSpace(doc, model, y, rowH)
    doc.setFillColor(HEADER_FILL.r, HEADER_FILL.g, HEADER_FILL.b)
    doc.rect(MARGIN, y - 4.2, usableWidth(doc), rowH, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8.5)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text(row.label, MARGIN + 2, y)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
    doc.text(pdfSafe(row.value), MARGIN + labelW, y)
    y += rowH
  }
  return y + 3
}

function drawLegend(
  doc: jsPDF,
  model: ProjectDesignExportModel,
  y: number
): number {
  const itemW = Math.min(70, usableWidth(doc) / 3)
  let x = MARGIN
  let rowY = y
  for (const item of model.legend) {
    if (x + itemW > pageWidth(doc) - MARGIN) {
      x = MARGIN
      rowY += 8
    }
    rowY = ensureSpace(doc, model, rowY, 8)
    const { r, g, b } = projectDesignColorToRgb(item.color)
    doc.setFillColor(r, g, b)
    if (item.kind === "trace") {
      doc.rect(x, rowY - 2.2, 10, 1.6, "F")
    } else if (item.kind === "gain") {
      doc.rect(x + 2.5, rowY - 4, 4, 4, "F")
    } else {
      doc.circle(x + 4, rowY - 1.4, 2.4, "F")
    }
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
    doc.text(item.label, x + 13, rowY)
    x += itemW
  }
  return rowY + 8
}

type TableColumn = {
  key: string
  label: string
  width: number
  align?: "left" | "right"
}

function drawTable(
  doc: jsPDF,
  model: ProjectDesignExportModel,
  columns: TableColumn[],
  rows: Array<Record<string, string>>,
  y: number
): number {
  if (rows.length === 0) {
    return drawEmptyState(doc, model, y)
  }

  const headerH = 6.4
  const minRowH = 6.2
  const usable = usableWidth(doc)
  const widths = columns.map((column) => (usable * column.width) / 100)

  const drawHeader = (at: number) => {
    doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b)
    doc.rect(MARGIN, at, usable, headerH, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7.5)
    doc.setTextColor(255, 255, 255)
    let x = MARGIN
    columns.forEach((column, index) => {
      const textX =
        column.align === "right" ? x + widths[index] - 1.6 : x + 1.6
      doc.text(column.label, textX, at + 4.3, {
        align: column.align === "right" ? "right" : "left",
      })
      x += widths[index]
    })
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
    return at + headerH
  }

  y = ensureSpace(doc, model, y, headerH + minRowH)
  y = drawHeader(y)

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    const wrapped = columns.map((column, index) => {
      const value = pdfSafe(row[column.key] || "—")
      return doc.splitTextToSize(value, widths[index] - 3.2) as string[]
    })
    const lineCount = Math.max(1, ...wrapped.map((lines) => lines.length))
    const rowH = Math.max(minRowH, lineCount * 3.6 + 2.2)
    if (y + rowH > contentBottom(doc)) {
      doc.addPage()
      y = drawMiniHeader(doc, model)
      y = drawHeader(y)
    }
    if (rowIndex % 2 === 1) {
      doc.setFillColor(248, 250, 252)
      doc.rect(MARGIN, y, usable, rowH, "F")
    }
    doc.setDrawColor(LINE.r, LINE.g, LINE.b)
    doc.setLineWidth(0.12)
    doc.rect(MARGIN, y, usable, rowH)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
    let x = MARGIN
    columns.forEach((column, index) => {
      const textX =
        column.align === "right" ? x + widths[index] - 1.6 : x + 1.6
      const lines = wrapped[index]
      lines.forEach((line, lineIndex) => {
        doc.text(line, textX, y + 4.1 + lineIndex * 3.6, {
          align: column.align === "right" ? "right" : "left",
        })
      })
      x += widths[index]
    })
    y += rowH
  }

  return y + 4
}

function drawMap(
  doc: jsPDF,
  model: ProjectDesignExportModel,
  mapDataUrl: string | null,
  y: number
): number {
  const width = usableWidth(doc)
  const height = model.orientation === "landscape" ? 92 : 118
  y = ensureSpace(doc, model, y, height + 10)
  if (mapDataUrl) {
    try {
      doc.addImage(mapDataUrl, "PNG", MARGIN, y, width, height, undefined, "FAST")
    } catch {
      mapDataUrl = null
    }
  }
  if (!mapDataUrl) {
    doc.setFillColor(HEADER_FILL.r, HEADER_FILL.g, HEADER_FILL.b)
    doc.rect(MARGIN, y, width, height, "F")
    doc.setDrawColor(LINE.r, LINE.g, LINE.b)
    doc.rect(MARGIN, y, width, height)
    doc.setFont("helvetica", "italic")
    doc.setFontSize(10)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text(
      model.map.hasRenderableFeatures
        ? "No se pudo renderizar el plano."
        : "Sin geometría de diseño",
      MARGIN + width / 2,
      y + height / 2,
      { align: "center" }
    )
  }
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  doc.text(
    "Plano técnico vectorial a partir del snapshot de Diseño. Teselas cartográficas omitidas para evitar CORS y pérdida de nitidez.",
    MARGIN,
    y + height + 4
  )
  return y + height + 9
}

function drawNotes(
  doc: jsPDF,
  model: ProjectDesignExportModel,
  y: number
): number {
  if (!model.notes) {
    return y
  }
  y = ensureSpace(doc, model, y, 16)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
  return writeWrapped(doc, model.notes, MARGIN, y, usableWidth(doc), 5) + 4
}

function drawFooters(doc: jsPDF) {
  const total = doc.getNumberOfPages()
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page)
    const y = pageHeight(doc) - 7
    doc.setDrawColor(LINE.r, LINE.g, LINE.b)
    doc.setLineWidth(0.2)
    doc.line(MARGIN, y - 4, pageWidth(doc) - MARGIN, y - 4)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text("Bespoke Operations", MARGIN, y)
    doc.text("Diseño de Obra", MARGIN + 42, y)
    doc.text(
      `Página ${page} de ${total}`,
      pageWidth(doc) - MARGIN,
      y,
      { align: "right" }
    )
  }
}

export async function renderProjectDesignPdf(
  model: ProjectDesignExportModel,
  assets: { logoDataUrl?: string | null; mapDataUrl?: string | null } = {}
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: model.orientation,
    unit: "mm",
    format: "a4",
  })

  let y = drawFullHeader(doc, model, assets.logoDataUrl ?? null)
  const sections = new Set(model.includedSections)

  if (sections.has("map")) {
    y = drawSectionTitle(doc, model, "Mapa del diseño", y)
    y = drawMap(doc, model, assets.mapDataUrl ?? null, y)
  }
  if (sections.has("legend")) {
    y = drawSectionTitle(doc, model, "Leyenda", y)
    y = drawLegend(doc, model, y)
  }
  if (sections.has("summary")) {
    y = drawSectionTitle(doc, model, "Resumen de la obra", y)
    y = drawKeyValueTable(doc, model, model.summary.rows, y)
  }
  if (sections.has("nodes")) {
    y = drawSectionTitle(doc, model, "Nodes", y)
    y = drawTable(
      doc,
      model,
      [
        { key: "identifier", label: "Identificador", width: 16 },
        { key: "name", label: "Nombre", width: 16 },
        { key: "latitude", label: "Latitud", width: 16 },
        { key: "longitude", label: "Longitud", width: 16 },
        { key: "gainM", label: "Ganancia (m)", width: 14, align: "right" },
        { key: "notes", label: "Observaciones", width: 22 },
      ],
      model.nodes,
      y
    )
  }
  if (sections.has("naps")) {
    y = drawSectionTitle(doc, model, "NAPs", y)
    y = drawTable(
      doc,
      model,
      [
        { key: "identifier", label: "Identificador", width: 16 },
        { key: "name", label: "Nombre", width: 16 },
        { key: "latitude", label: "Latitud", width: 16 },
        { key: "longitude", label: "Longitud", width: 16 },
        { key: "gainM", label: "Ganancia (m)", width: 14, align: "right" },
        { key: "notes", label: "Observaciones", width: 22 },
      ],
      model.naps,
      y
    )
  }
  if (sections.has("traces")) {
    y = drawSectionTitle(doc, model, "Trazas", y)
    y = drawTable(
      doc,
      model,
      [
        { key: "identifier", label: "Identificador / nombre", width: 22 },
        { key: "type", label: "Tipo", width: 12 },
        { key: "origin", label: "Origen", width: 16 },
        { key: "destination", label: "Destino", width: 16 },
        {
          key: "plannedLengthM",
          label: "Metros planificados",
          width: 14,
          align: "right",
        },
        { key: "notes", label: "Observaciones", width: 20 },
      ],
      model.traces,
      y
    )
  }
  if (sections.has("gains")) {
    y = drawSectionTitle(doc, model, "Puntos de ganancia", y)
    y = drawTable(
      doc,
      model,
      [
        { key: "identifier", label: "Identificador", width: 14 },
        { key: "trace", label: "Traza", width: 28 },
        { key: "latitude", label: "Latitud", width: 18 },
        { key: "longitude", label: "Longitud", width: 18 },
        { key: "gainM", label: "Ganancia (m)", width: 22, align: "right" },
      ],
      model.gains,
      y
    )
  }
  if (sections.has("notes")) {
    y = drawSectionTitle(doc, model, "Observaciones", y)
    drawNotes(doc, model, y)
  }

  drawFooters(doc)
  return doc.output("blob")
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function exportProjectDesignToPdf(input: {
  project: Pick<
    Project,
    | "id"
    | "code"
    | "name"
    | "status"
    | "location"
    | "description"
    | "latitude"
    | "longitude"
  >
  snapshot: ProjectDesignSnapshot
  options: ProjectDesignExportOptions
}): Promise<{ filename: string }> {
  const model = buildProjectDesignExportModel(input)
  const [logoDataUrl, mapDataUrl] = await Promise.all([
    loadExportLogoDataUrl(),
    model.includedSections.includes("map")
      ? renderProjectDesignMapForPdf({
          model: model.map,
          widthPx: model.orientation === "landscape" ? 1700 : 1200,
          heightPx: model.orientation === "landscape" ? 920 : 1400,
        })
      : Promise.resolve(null),
  ])
  const blob = await renderProjectDesignPdf(model, { logoDataUrl, mapDataUrl })
  downloadBlob(blob, model.filename)
  return { filename: model.filename }
}

export const PROJECT_DESIGN_PDF_EXPORT_ERROR =
  "No se pudo generar el PDF. Intente nuevamente."
