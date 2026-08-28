import type { MaterialCategory } from "@/lib/types/materials"

export type MaterialUnitCode = "m" | "un"

/** Friendly labels for UI (DB keeps m / un). */
export const MATERIAL_UNIT_DISPLAY: Record<MaterialUnitCode, string> = {
  m: "Metros",
  un: "Piezas",
}

/** Labels for unit pickers in forms. */
export const MATERIAL_UNIT_LABELS: Record<MaterialUnitCode, string> = {
  m: "Metros",
  un: "Piezas",
}

export const SELECTABLE_MATERIAL_UNITS: MaterialUnitCode[] = ["m", "un"]

export type CategoryUnitRule =
  | { mode: "fixed"; unit: MaterialUnitCode }
  | { mode: "selectable"; units: MaterialUnitCode[] }

const CATEGORY_UNIT_RULES: Record<MaterialCategory, CategoryUnitRule> = {
  "fiber-optic": { mode: "fixed", unit: "m" },
  cameras: { mode: "fixed", unit: "un" },
  wireless: { mode: "fixed", unit: "un" },
  "pole-infrastructure": { mode: "fixed", unit: "un" },
  "network-equipment": { mode: "fixed", unit: "un" },
  consumables: { mode: "selectable", units: ["m", "un"] },
}

export function normalizeMaterialUnit(unit: string): MaterialUnitCode {
  const trimmed = unit.trim().toLowerCase()
  if (trimmed === "m" || trimmed === "metro" || trimmed === "metros") return "m"
  if (
    trimmed === "un" ||
    trimmed === "pza" ||
    trimmed === "pzas" ||
    trimmed === "u" ||
    trimmed === "unidad" ||
    trimmed === "unidades" ||
    trimmed === "pieza" ||
    trimmed === "piezas"
  ) {
    return "un"
  }
  return trimmed === "m" ? "m" : "un"
}

export function getCategoryUnitRule(category: MaterialCategory): CategoryUnitRule {
  return CATEGORY_UNIT_RULES[category]
}

export function resolveUnitForCategory(
  category: MaterialCategory,
  currentUnit?: string
): MaterialUnitCode {
  const rule = getCategoryUnitRule(category)
  if (rule.mode === "fixed") return rule.unit
  if (currentUnit) return normalizeMaterialUnit(currentUnit)
  return "un"
}

export function isIntegerOnlyUnit(unit: string): boolean {
  return normalizeMaterialUnit(unit) === "un"
}

export function formatUnitLabel(unit: string): string {
  const normalized = normalizeMaterialUnit(unit)
  return MATERIAL_UNIT_DISPLAY[normalized]
}

export function categoryChangeAffectsUnit(
  fromCategory: MaterialCategory,
  toCategory: MaterialCategory,
  currentUnit: string
): boolean {
  const fromRule = getCategoryUnitRule(fromCategory)
  const toRule = getCategoryUnitRule(toCategory)
  const fromUnit = resolveUnitForCategory(fromCategory, currentUnit)
  const toUnit = resolveUnitForCategory(toCategory, currentUnit)
  return fromUnit !== toUnit || fromRule.mode !== toRule.mode
}
