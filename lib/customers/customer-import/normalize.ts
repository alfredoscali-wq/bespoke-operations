import {
  WORK_ORDER_TECHNOLOGY_OPTIONS,
  type WorkOrderTechnology,
} from "@/lib/tasks/work-order"
import type { CustomerImportStatus } from "@/lib/customers/customer-import/types"

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

const TECHNOLOGY_LOOKUP = new Map<string, WorkOrderTechnology>()

for (const option of WORK_ORDER_TECHNOLOGY_OPTIONS) {
  TECHNOLOGY_LOOKUP.set(normalizeText(option.value), option.value)
  TECHNOLOGY_LOOKUP.set(normalizeText(option.label), option.value)
}

TECHNOLOGY_LOOKUP.set("fibra", "fiber")
TECHNOLOGY_LOOKUP.set("fibra optica", "fiber")
TECHNOLOGY_LOOKUP.set("radio", "wireless")

const STATUS_LOOKUP = new Map<string, CustomerImportStatus>([
  ["activo", "activo"],
  ["active", "activo"],
  ["inactivo", "inactivo"],
  ["inactive", "inactivo"],
])

export function resolveImportTechnology(
  value: unknown
): WorkOrderTechnology | "" {
  const raw = String(value ?? "").trim()
  if (!raw) return ""

  const normalized = normalizeText(raw)
  return TECHNOLOGY_LOOKUP.get(normalized) ?? ""
}

export function resolveImportStatus(value: unknown): CustomerImportStatus {
  const raw = String(value ?? "").trim()
  if (!raw) return ""

  const normalized = normalizeText(raw)
  return STATUS_LOOKUP.get(normalized) ?? ""
}

export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) {
    return value.toISOString()
  }
  return String(value).trim()
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidImportEmail(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  return EMAIL_PATTERN.test(trimmed)
}

export function normalizeDuplicateKey(value: string): string {
  return normalizeText(value)
}
