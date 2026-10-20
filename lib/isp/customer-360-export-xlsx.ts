import ExcelJS from "exceljs"

import {
  ISP_CUSTOMER_360_EXPORT_HEADERS,
  ISP_CUSTOMER_360_EXPORT_SHEET_NAME,
  ispCustomer360ExportRowValues,
  type IspCustomer360ExportRow,
} from "@/lib/isp/customer-360-export"

const MONTHLY_FEE_COLUMN = 23
const CURRENCY_FORMAT = '"$" #,##0.00'

export async function buildIspCustomer360ExportWorkbook(
  rows: IspCustomer360ExportRow[],
  padron?: {
    subscribers: {
      number: string
      name: string
      origin: string
      link: string
      connections: number
      status: string
      gratis: string
      plan: string
      note: string
    }[]
    connections: {
      id: string
      number: string
      name: string
      status: string
      gratis: string
      plan: string
      node: string
    }[]
  } | null
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Bespoke Clientes 360"
  const sheet = workbook.addWorksheet(ISP_CUSTOMER_360_EXPORT_SHEET_NAME, {
    views: [{ state: "frozen", ySplit: 1, activeCell: "A2" }],
  })

  const header = sheet.addRow([...ISP_CUSTOMER_360_EXPORT_HEADERS])
  header.font = { bold: true }
  header.alignment = { vertical: "middle", wrapText: true }

  for (const row of rows) {
    const values = ispCustomer360ExportRowValues(row)
    const excelRow = sheet.addRow(values)
    excelRow.alignment = { vertical: "middle", wrapText: true }
    const feeCell = excelRow.getCell(MONTHLY_FEE_COLUMN)
    if (typeof feeCell.value === "number") {
      feeCell.numFmt = CURRENCY_FORMAT
    } else {
      feeCell.value = null
    }
  }

  const lastRow = Math.max(sheet.rowCount, 1)
  const lastCol = ISP_CUSTOMER_360_EXPORT_HEADERS.length
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: lastRow, column: lastCol },
  }

  if (padron) {
    const subscribers = workbook.addWorksheet("Abonados padrón", {
      views: [{ state: "frozen", ySplit: 1 }],
    })
    subscribers.addRow([
      "Número ABNet",
      "Nombre",
      "Origen",
      "Vínculo",
      "Conexiones",
      "Estado de conexión",
      "Gratuidad",
      "Plan comercial",
      "Nota",
    ]).font = { bold: true }
    for (const row of padron.subscribers) {
      subscribers.addRow([
        row.number,
        row.name,
        row.origin,
        row.link,
        row.connections,
        row.status,
        row.gratis,
        row.plan,
        row.note,
      ])
    }
    const connections = workbook.addWorksheet("Conexiones padrón", {
      views: [{ state: "frozen", ySplit: 1 }],
    })
    connections.addRow([
      "Id conexión",
      "Número ABNet",
      "Nombre",
      "Estado",
      "Gratuidad",
      "Plan",
      "Nodo",
    ]).font = { bold: true }
    for (const row of padron.connections) {
      connections.addRow([
        row.id,
        row.number,
        row.name,
        row.status,
        row.gratis,
        row.plan,
        row.node,
      ])
    }
  }

  sheet.columns.forEach((column, index) => {
    let max = ISP_CUSTOMER_360_EXPORT_HEADERS[index]?.length ?? 12
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const value = cell.value
      const length =
        value == null
          ? 0
          : typeof value === "number"
            ? String(value).length + 4
            : String(value).length
      if (length > max) max = length
    })
    column.width = Math.min(Math.max(max + 2, 12), 42)
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
