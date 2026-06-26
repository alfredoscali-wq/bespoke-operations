/** Clave de comparación: minúsculas, sin acentos, espacios colapsados. */
export function normalizeComparisonKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
}

export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true
  return String(value).trim() === ""
}

export function trimString(value: unknown): string {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

/** Reparaciones puntuales de mojibake frecuente en el dump legacy. */
export function repairLegacyEncoding(value: string): string {
  return value
    .replace(/MALAGUEÃ'O/gi, "Malagueño")
    .replace(/MalagueÃ±o/gi, "Malagueño")
    .replace(/ColonÃ­a/gi, "Colonia")
    .replace(/CÃ³rdoba/gi, "Córdoba")
    .replace(/CÃÓRDOBA/gi, "CÓRDOBA")
    .replace(/RÃ­o Segundo/gi, "Río Segundo")
    .replace(/MALAGUEÃ\u0091O/gi, "Malagueño")
}
