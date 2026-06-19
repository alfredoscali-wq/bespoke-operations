import {
  WORK_ORDER_SERVICE_TYPE_LABELS,
  WORK_ORDER_SERVICE_TYPE_OPTIONS,
  WORK_ORDER_TECHNOLOGY_OPTIONS,
  type WorkOrderServiceType,
  type WorkOrderTechnology,
} from "@/lib/tasks/work-order"
import * as XLSX from "xlsx"

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

const SERVICE_TYPE_LOOKUP = new Map<string, WorkOrderServiceType>()

for (const option of WORK_ORDER_SERVICE_TYPE_OPTIONS) {
  SERVICE_TYPE_LOOKUP.set(normalizeText(option.value), option.value)
  SERVICE_TYPE_LOOKUP.set(normalizeText(option.label), option.value)
}

SERVICE_TYPE_LOOKUP.set("instalacion", "instalacion-nueva")
SERVICE_TYPE_LOOKUP.set("service tecnico", "service-tecnico")
SERVICE_TYPE_LOOKUP.set("retiro de equipo", "retiro-equipos")
SERVICE_TYPE_LOOKUP.set("retiro equipos", "retiro-equipos")
SERVICE_TYPE_LOOKUP.set("cambio de tecnologia", "cambio-tecnologia")

const TECHNOLOGY_LOOKUP = new Map<string, WorkOrderTechnology>()

for (const option of WORK_ORDER_TECHNOLOGY_OPTIONS) {
  TECHNOLOGY_LOOKUP.set(normalizeText(option.value), option.value)
  TECHNOLOGY_LOOKUP.set(normalizeText(option.label), option.value)
}

TECHNOLOGY_LOOKUP.set("fibra", "fiber")
TECHNOLOGY_LOOKUP.set("fibra optica", "fiber")
TECHNOLOGY_LOOKUP.set("radio", "wireless")

export function resolveImportServiceType(
  value: unknown
): WorkOrderServiceType | "" {
  const raw = String(value ?? "").trim()
  if (!raw) return ""

  const normalized = normalizeText(raw.replace(/-/g, " "))
  return SERVICE_TYPE_LOOKUP.get(normalized) ?? SERVICE_TYPE_LOOKUP.get(raw) ?? ""
}

export function resolveImportTechnology(
  value: unknown
): WorkOrderTechnology | "" {
  const raw = String(value ?? "").trim()
  if (!raw) return ""

  const normalized = normalizeText(raw)
  return TECHNOLOGY_LOOKUP.get(normalized) ?? ""
}

export function getImportServiceTypeLabel(
  serviceType: WorkOrderServiceType | ""
): string {
  if (!serviceType) return ""
  return WORK_ORDER_SERVICE_TYPE_LABELS[serviceType] ?? serviceType
}

export function parseImportDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) {
      const month = String(parsed.m).padStart(2, "0")
      const day = String(parsed.d).padStart(2, "0")
      return `${parsed.y}-${month}-${day}`
    }
  }

  const raw = String(value ?? "").trim()
  if (!raw) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw
  }

  const slashMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, "0")
    const month = slashMatch[2].padStart(2, "0")
    const year =
      slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]
    return `${year}-${month}-${day}`
  }

  const parsedDate = new Date(raw)
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.toISOString().slice(0, 10)
  }

  return null
}

export function formatImportDateDisplay(value: string): string {
  if (!value) return ""
  const [year, month, day] = value.split("-")
  if (!year || !month || !day) return value
  return `${day}/${month}/${year.slice(-2)}`
}

export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) {
    return parseImportDate(value) ?? ""
  }
  return String(value).trim()
}
