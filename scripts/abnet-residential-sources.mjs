import { createRequire } from "node:module"
import { readFileSync } from "node:fs"
import path from "node:path"

import { abnetNumberFromCell } from "../lib/isp/abnet-residential-load.ts"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "../lib/supabase/company.constants.ts"

const require = createRequire(import.meta.url)
const XLSX = require("xlsx")

export const ABNET_COMPANY_ID = BESPOKE_PRODUCTION_COMPANY_ID
export const DEFAULT_CONEX = "C:\\Users\\alfre\\Downloads\\Conex. Internet + TV.xlsx"
export const DEFAULT_BILLING = "C:\\Users\\alfre\\Downloads\\conexiones_4037_facturables.xlsx"

function text(value) {
  if (value == null) return null
  const current = String(value).trim()
  return current.length > 0 ? current : null
}

function amount(value) {
  if (value == null || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function readMatrix(file) {
  const base = path.basename(file).toLowerCase()
  if (base.includes("base clientes")) {
    throw new Error("Este sprint no reinterpreta el maestro como padrón de servicios.")
  }
  const workbook = XLSX.readFile(file, { cellDates: false })
  const sheetName = workbook.SheetNames.includes("Datos") ? "Datos" : workbook.SheetNames[0]
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: true,
  })
}

export function readInternetRows(filePath) {
  return readMatrix(filePath).slice(2).flatMap((row) => {
    const number = abnetNumberFromCell(row[0])
    if (!number) return []
    return [{
      number,
      name: text(row[1]) ?? "",
      tipo: text(row[2]) ?? "",
      nodo: text(row[3]),
      plan: text(row[4]) ?? "",
      estado: text(row[5]) ?? "",
      tv: amount(row[6]),
      finalAmount: amount(row[8]),
    }]
  })
}

export function readBillingRows(filePath) {
  return readMatrix(filePath).slice(1).flatMap((row) => {
    const number = abnetNumberFromCell(row[0])
    if (!number) return []
    return [{
      number,
      tipo: text(row[2]) ?? "",
      nodo: text(row[3]),
      ip: text(row[4]),
    }]
  })
}

export function loadEnv() {
  const env = readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8")
  const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim()
  const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim()
  if (!url || !key) throw new Error("Faltan las credenciales de Supabase.")
  return { url, key }
}

export async function fetchAll(client, table, columns) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .eq("company_id", ABNET_COMPANY_ID)
      .order("id", { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if ((data ?? []).length < PAGE_SIZE()) break
  }
  return rows
}

function PAGE_SIZE() {
  return 1000
}
