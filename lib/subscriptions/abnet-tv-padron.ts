import { abnetNumberFromExternalCode } from "@/lib/isp/abnet-master-universe"

export const ABNET_TV_PADRON_SOURCE = "conex-internet-tv.xlsx"
export const ABNET_TV_BASICA_AMOUNT = 4500
export const ABNET_TV_BASICA_PACK_AMOUNT = 7500
export const ABNET_TV_FULL_AMOUNT = 9900

export const ABNET_TV_PADRON_STATUSES = [
  "Activa",
  "Morosa",
  "Pendiente",
  "Inactiva",
] as const

export type AbnetTvPadronStatus = (typeof ABNET_TV_PADRON_STATUSES)[number]

export type AbnetTvKind = "basica" | "full" | "pack" | "other"

export type AbnetTvPadronSourceRow = {
  source: string
  sourceRow: number
  abnetCustomerNumber: string
  customerName: string
  serviceType: string
  node: string
  planName: string
  status: string
  tvAmount: number | null
  tvTaxAmount: number | null
  finalAmount: number | null
}

export type AbnetTvPadronRow = AbnetTvPadronSourceRow & {
  tvKind: AbnetTvKind
  tvLabel: string
  jubilado: boolean
  duplicateGroupSize: number
  bespokeCustomerId: string | null
  bespokeCustomerNumber: string | null
  bespokeCustomerName: string | null
  packFutbolActive: boolean
}

export type AbnetTvPadronSummary = {
  rows: number
  uniqueCustomers: number
  basicaRows: number
  basicaAmount: number
  fullRows: number
  fullAmount: number
  basicaPackRows: number
  basicaPackAmount: number
  jubiladoRows: number
  jubiladoAmount: number
  jubiladoRowsAt2250: number
  jubiladoRowsAt4500: number
  statusRows: Record<string, number>
}

export type AbnetTvPadronFilters = {
  tvKind: "all" | AbnetTvKind
  jubilado: boolean
  status: "all" | string
  duplicatesOnly: boolean
  search: string
}

export function abnetPadronMoney(value: unknown): number | null {
  if (value == null || value === "") return null
  const number = typeof value === "number" ? value : Number(String(value).trim())
  if (!Number.isFinite(number)) return null
  return Math.round(number * 100) / 100
}

export function abnetPadronCustomerNumber(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return abnetNumberFromExternalCode(String(Math.trunc(value)))
  }
  return abnetNumberFromExternalCode(value == null ? null : String(value))
}

export function foldAbnetPadronText(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

export function isAbnetJubiladoPlan(planName: string | null | undefined): boolean {
  return foldAbnetPadronText(planName).includes("jubilado")
}

/**
 * TV Básica and TV Full come only from the Excel TV amount.
 * A plan name that says FULL does not change the amount.
 */
export function classifyAbnetPadronTv(amount: number | null): {
  kind: AbnetTvKind
  label: string
} {
  if (amount === ABNET_TV_BASICA_AMOUNT) {
    return { kind: "basica", label: "TV Básica" }
  }
  if (amount === ABNET_TV_BASICA_PACK_AMOUNT) {
    return { kind: "pack", label: "TV Básica + Pack Fútbol" }
  }
  if (amount === ABNET_TV_FULL_AMOUNT) {
    return { kind: "full", label: "TV Full" }
  }
  if (amount == null) return { kind: "other", label: "—" }
  return { kind: "other", label: String(amount) }
}

export function formatAbnetPadronMoney(amount: number): string {
  return `$${amount.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
}

/** Visible TV label. Jubilado stays a 50% condition on the real TV amount. */
export function abnetPadronTvRowLabel(
  row: Pick<AbnetTvPadronRow, "tvKind" | "tvAmount" | "jubilado">
): string {
  if (row.jubilado) {
    if (row.tvAmount === ABNET_TV_BASICA_AMOUNT) return "TV Básica + Jubilado 50%"
    if (row.tvAmount == null) return "Jubilado 50%"
    return `TV ${formatAbnetPadronMoney(row.tvAmount)} + Jubilado 50%`
  }
  if (row.tvKind === "basica") return "TV Básica"
  if (row.tvKind === "full") return "TV Full"
  if (row.tvKind === "pack") return "TV Básica + Pack Fútbol"
  if (row.tvAmount == null) return "—"
  return `TV ${formatAbnetPadronMoney(row.tvAmount)}`
}

export function summarizeAbnetTvPadron(
  rows: readonly Pick<
    AbnetTvPadronRow,
    "abnetCustomerNumber" | "tvKind" | "jubilado" | "status" | "tvAmount"
  >[]
): AbnetTvPadronSummary {
  const statusRows: Record<string, number> = {}
  const numbers = new Set<string>()
  let basicaRows = 0
  let basicaAmount = 0
  let fullRows = 0
  let fullAmount = 0
  let basicaPackRows = 0
  let basicaPackAmount = 0
  let jubiladoRows = 0
  let jubiladoAmount = 0
  let jubiladoRowsAt2250 = 0
  let jubiladoRowsAt4500 = 0
  for (const row of rows) {
    numbers.add(row.abnetCustomerNumber)
    const tvAmount = row.tvAmount ?? 0
    if (row.tvKind === "basica") {
      basicaRows += 1
      basicaAmount += tvAmount
    }
    if (row.tvKind === "full") {
      fullRows += 1
      fullAmount += tvAmount
    }
    if (row.tvKind === "pack") {
      basicaPackRows += 1
      basicaPackAmount += tvAmount
    }
    if (row.jubilado) {
      jubiladoRows += 1
      jubiladoAmount += tvAmount
      if (row.tvAmount === 2250) jubiladoRowsAt2250 += 1
      if (row.tvAmount === ABNET_TV_BASICA_AMOUNT) jubiladoRowsAt4500 += 1
    }
    const status = row.status.trim() || "Sin estado"
    statusRows[status] = (statusRows[status] ?? 0) + 1
  }
  return {
    rows: rows.length,
    uniqueCustomers: numbers.size,
    basicaRows,
    basicaAmount,
    fullRows,
    fullAmount,
    basicaPackRows,
    basicaPackAmount,
    jubiladoRows,
    jubiladoAmount,
    jubiladoRowsAt2250,
    jubiladoRowsAt4500,
    statusRows,
  }
}

export function withAbnetPadronDuplicates<T extends { abnetCustomerNumber: string }>(
  rows: readonly T[]
): (T & { duplicateGroupSize: number })[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    counts.set(
      row.abnetCustomerNumber,
      (counts.get(row.abnetCustomerNumber) ?? 0) + 1
    )
  }
  return rows.map((row) => ({
    ...row,
    duplicateGroupSize: counts.get(row.abnetCustomerNumber) ?? 1,
  }))
}

export function matchesAbnetPadronFilters(
  row: Pick<
    AbnetTvPadronRow,
    | "tvKind"
    | "jubilado"
    | "status"
    | "duplicateGroupSize"
    | "abnetCustomerNumber"
    | "customerName"
    | "planName"
    | "serviceType"
    | "node"
    | "bespokeCustomerNumber"
    | "bespokeCustomerName"
  >,
  filters: AbnetTvPadronFilters
): boolean {
  if (filters.tvKind !== "all" && row.tvKind !== filters.tvKind) return false
  if (filters.jubilado && !row.jubilado) return false
  if (filters.status !== "all" && row.status.trim() !== filters.status) return false
  if (filters.duplicatesOnly && row.duplicateGroupSize < 2) return false
  const needle = filters.search.trim().toLowerCase()
  if (!needle) return true
  return [
    row.abnetCustomerNumber,
    row.customerName,
    row.planName,
    row.serviceType,
    row.node,
    row.bespokeCustomerNumber ?? "",
    row.bespokeCustomerName ?? "",
  ].some((value) => value.toLowerCase().includes(needle))
}

function headerIndex(header: readonly unknown[], aliases: readonly string[]): number {
  const folded = header.map((cell) =>
    foldAbnetPadronText(cell == null ? "" : String(cell)).replace(/[^a-z0-9]/g, "")
  )
  for (const alias of aliases) {
    const index = folded.indexOf(alias)
    if (index >= 0) return index
  }
  return -1
}

function cellText(value: unknown): string {
  if (value == null) return ""
  return String(value).trim()
}

export function readAbnetTvPadronMatrix(
  matrix: readonly (readonly unknown[])[],
  source = ABNET_TV_PADRON_SOURCE
): AbnetTvPadronSourceRow[] {
  const header = matrix[1]
  if (!header) throw new Error("El padrón no tiene la fila de encabezados.")
  const numberIndex = headerIndex(header, ["ncliente", "numerocliente"])
  const nameIndex = headerIndex(header, ["cliente", "nombre"])
  const typeIndex = headerIndex(header, ["tipo"])
  const nodeIndex = headerIndex(header, ["nodo"])
  const planIndex = headerIndex(header, ["plan"])
  const statusIndex = headerIndex(header, ["estado"])
  const tvIndex = headerIndex(header, ["tv"])
  const taxIndex = headerIndex(header, ["2imptv"])
  const finalIndex = headerIndex(header, ["final"])
  if (
    [
      numberIndex,
      nameIndex,
      typeIndex,
      nodeIndex,
      planIndex,
      statusIndex,
      tvIndex,
      taxIndex,
      finalIndex,
    ].some((index) => index < 0)
  ) {
    throw new Error(
      "El padrón no tiene N° Cliente, Cliente, Tipo, Nodo, Plan, Estado, TV, 2% IMP. TV y FINAL."
    )
  }

  const rows: AbnetTvPadronSourceRow[] = []
  for (let index = 2; index < matrix.length; index += 1) {
    const line = matrix[index] ?? []
    const values = [
      line[numberIndex],
      line[nameIndex],
      line[typeIndex],
      line[nodeIndex],
      line[planIndex],
      line[statusIndex],
      line[tvIndex],
      line[taxIndex],
      line[finalIndex],
    ]
    if (values.every((value) => cellText(value) === "")) continue
    const number = abnetPadronCustomerNumber(line[numberIndex])
    if (!number) continue
    rows.push({
      source,
      sourceRow: index + 1,
      abnetCustomerNumber: number,
      customerName: cellText(line[nameIndex]),
      serviceType: cellText(line[typeIndex]),
      node: cellText(line[nodeIndex]),
      planName: cellText(line[planIndex]),
      status: cellText(line[statusIndex]),
      tvAmount: abnetPadronMoney(line[tvIndex]),
      tvTaxAmount: abnetPadronMoney(line[taxIndex]),
      finalAmount: abnetPadronMoney(line[finalIndex]),
    })
  }
  return rows
}

export function presentAbnetPadronRow(
  row: AbnetTvPadronSourceRow & { duplicateGroupSize: number }
): AbnetTvPadronRow {
  const tv = classifyAbnetPadronTv(row.tvAmount)
  return {
    ...row,
    tvKind: tv.kind,
    tvLabel: tv.label,
    jubilado: isAbnetJubiladoPlan(row.planName),
    bespokeCustomerId: null,
    bespokeCustomerNumber: null,
    bespokeCustomerName: null,
    packFutbolActive: false,
  }
}
