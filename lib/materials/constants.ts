import type {
  AssignmentStatus,
  DbMovementType,
  MaterialCategory,
  MaterialItemType,
  MaterialStatus,
  MovementType,
} from "@/lib/types/materials"
import { formatDateOnlyDateTime } from "@/lib/dates/date-only"
import { resolveStockStatus } from "@/lib/materials/stock-status"

export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  "fiber-optic": "Fibra Óptica",
  cameras: "Cámaras",
  wireless: "Wireless",
  "pole-infrastructure": "Postación",
  "network-equipment": "Equipo de Red",
  consumables: "Consumibles",
}

export const MATERIAL_CATEGORY_STYLES: Record<MaterialCategory, string> = {
  "fiber-optic": "bg-blue-50 text-blue-700 border-blue-100",
  cameras: "bg-violet-50 text-violet-700 border-violet-100",
  wireless: "bg-amber-50 text-amber-700 border-amber-100",
  "pole-infrastructure": "bg-stone-100 text-stone-700 border-stone-200",
  "network-equipment": "bg-teal-50 text-teal-700 border-teal-100",
  consumables: "bg-orange-50 text-orange-700 border-orange-100",
}

export const MATERIAL_CATEGORY_OPTIONS = Object.entries(
  MATERIAL_CATEGORY_LABELS
).map(([value, label]) => ({
  value: value as MaterialCategory,
  label,
}))

export const MATERIAL_STATUS_LABELS: Record<MaterialStatus, string> = {
  available: "Disponible",
  "low-stock": "Stock Bajo",
  "out-of-stock": "Agotado",
  discontinued: "Descontinuado",
}

export const MATERIAL_STATUS_STYLES: Record<MaterialStatus, string> = {
  available: "bg-emerald-50 text-emerald-700 border-emerald-100",
  "low-stock": "bg-amber-50 text-amber-700 border-amber-100",
  "out-of-stock": "bg-red-50 text-red-700 border-red-100",
  discontinued: "bg-slate-100 text-slate-600 border-slate-200",
}

export const CATALOG_INVENTORY_STATUS_LABELS: Record<
  MaterialStatus | "no-inventory",
  string
> = {
  ...MATERIAL_STATUS_LABELS,
  "no-inventory": "Sin stock registrado",
}

export const CATALOG_INVENTORY_STATUS_STYLES: Record<
  MaterialStatus | "no-inventory",
  string
> = {
  ...MATERIAL_STATUS_STYLES,
  "no-inventory": "bg-slate-50 text-slate-600 border-slate-200",
}

export const MATERIAL_STATUS_OPTIONS = Object.entries(
  MATERIAL_STATUS_LABELS
).map(([value, label]) => ({
  value: value as MaterialStatus,
  label,
}))

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  inbound: "Entrada",
  outbound: "Salida",
  transfer: "Transferencia",
  consumption: "Consumo",
  adjustment: "Ajuste",
}

export const MOVEMENT_TYPE_STYLES: Record<MovementType, string> = {
  inbound: "bg-emerald-50 text-emerald-700 border-emerald-100",
  outbound: "bg-red-50 text-red-700 border-red-100",
  transfer: "bg-blue-50 text-blue-700 border-blue-100",
  consumption: "bg-orange-50 text-orange-700 border-orange-100",
  adjustment: "bg-slate-100 text-slate-700 border-slate-200",
}

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  assigned: "Asignado",
  "in-use": "En Uso",
  consumed: "Consumido",
  returned: "Devuelto",
}

export const ASSIGNMENT_STATUS_STYLES: Record<AssignmentStatus, string> = {
  assigned: "bg-blue-50 text-blue-700 border-blue-100",
  "in-use": "bg-amber-50 text-amber-700 border-amber-100",
  consumed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  returned: "bg-slate-100 text-slate-600 border-slate-200",
}

export const MATERIAL_ITEM_TYPE_LABELS: Record<MaterialItemType, string> = {
  consumable: "Consumible",
  equipment: "Equipo",
}

export const MATERIAL_ITEM_TYPE_OPTIONS = Object.entries(
  MATERIAL_ITEM_TYPE_LABELS
).map(([value, label]) => ({
  value: value as MaterialItemType,
  label,
}))

export const MATERIAL_UNIT_SUGGESTIONS = ["m", "un"] as const

export const DB_MOVEMENT_TYPE_TO_UI: Record<DbMovementType, MovementType> = {
  entry: "inbound",
  exit: "outbound",
  transfer: "transfer",
  adjustment: "adjustment",
}

export function formatMaterialDateTime(date: string) {
  return formatDateOnlyDateTime(date)
}

export function resolveMaterialStatus(
  stock: number,
  minStock: number,
  current: MaterialStatus
): MaterialStatus {
  if (current === "discontinued") return "discontinued"
  return resolveStockStatus(stock, minStock, true)
}
