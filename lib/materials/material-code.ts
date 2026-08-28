import type { MaterialCatalogItem } from "@/lib/types/materials"

export function formatDuplicateActiveMaterialCodeMessage(code: string): string {
  const trimmed = code.trim()
  if (!trimmed) {
    return "Ya existe un material activo con este código. Buscálo en el catálogo y registrá el stock mediante Entrada."
  }
  return `Ya existe un material activo con el código ${trimmed}. Buscálo en el catálogo y registrá el stock mediante Entrada.`
}

export function hasActiveCatalogCodeConflict(
  catalog: MaterialCatalogItem[],
  code: string,
  excludeMaterialId?: string
): boolean {
  const normalized = code.trim().toLowerCase()
  if (!normalized) return false

  return catalog.some(
    (item) =>
      item.active &&
      item.code.trim().toLowerCase() === normalized &&
      item.id !== excludeMaterialId
  )
}

export function mapMaterialCodeErrorMessage(message: string): string {
  const lower = message.toLowerCase()
  if (
    lower.includes("ya existe un material activo con el código") ||
    lower.includes("materials_company_active_code_unique") ||
    lower.includes("materials_company_code_unique")
  ) {
    const match = message.match(
      /código\s+([^\s.]+)\./i
    )
    if (match?.[1]) {
      return formatDuplicateActiveMaterialCodeMessage(match[1])
    }
    return formatDuplicateActiveMaterialCodeMessage("")
  }
  return message
}
