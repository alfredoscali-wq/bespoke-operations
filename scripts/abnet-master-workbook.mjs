import { createRequire } from "node:module"
import path from "node:path"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

function normalizeHeader(value) {
  return String(value)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function cell(value) {
  if (value == null) return null
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null
    return String(Math.trunc(value))
  }
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function columnKey(headers, aliases) {
  return headers.find((header) => aliases.includes(normalizeHeader(header))) ?? null
}

export function assertAbnetMasterWorkbookPath(filePath) {
  const base = path.basename(filePath).toLowerCase()
  if (base.includes("conex") || base.includes("internet")) {
    throw new Error(
      "Este sprint no procesa Conex. Internet + TV. Use solo el maestro BASE CLIENTES."
    )
  }
}

export function readAbnetMasterRows(filePath) {
  assertAbnetMasterWorkbookPath(filePath)
  const workbook = XLSX.readFile(filePath, { cellDates: false })
  const sheetName = workbook.SheetNames.includes("Datos")
    ? "Datos"
    : workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  })
  const headerRow = matrix[0] ?? []
  const headers = headerRow.map((value, index) =>
    value == null ? `column_${index}` : String(value)
  )

  const numberKey = columnKey(headers, ["ncliente", "numerocliente"])
  const nameKey = columnKey(headers, ["nombre"])
  const documentKey = columnKey(headers, ["dnicuit", "documento"])
  const emailKey = columnKey(headers, ["email", "correo"])
  const phoneKey = columnKey(headers, ["telefono"])
  const addressKey = columnKey(headers, ["domicilio"])
  const provinceKey = columnKey(headers, ["provincia"])
  const cityKey = columnKey(headers, ["ciudad"])

  if (!numberKey || !nameKey) {
    throw new Error("El maestro no tiene las columnas N° Cliente y Nombre.")
  }

  const indexOf = new Map(headers.map((header, index) => [header, index]))

  return matrix.slice(1).flatMap((row) => {
    if (!Array.isArray(row) || row.every((value) => value == null || value === "")) {
      return []
    }
    const read = (key) => (key ? cell(row[indexOf.get(key)]) : null)
    const customerNumber = read(numberKey)
    if (!customerNumber) return []
    return [
      {
        customerNumber,
        name: read(nameKey) ?? "",
        document: read(documentKey),
        email: read(emailKey),
        phone: read(phoneKey),
        address: read(addressKey),
        province: read(provinceKey),
        city: read(cityKey),
      },
    ]
  })
}
