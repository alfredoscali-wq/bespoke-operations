/**
 * Employee codes are unique for the lifetime of the company.
 * Soft-deleted rows still hold their code under employees_company_code_unique.
 *
 * Callers MUST pass codes from every employee of the company, including
 * rows with deleted_at set. Never pass an active-only list.
 */

/** Next EMP-#### from the highest numeric suffix among all provided codes. */
export function buildNextEmployeeCode(existingCodes: string[]): string {
  let max = 0

  for (const code of existingCodes) {
    const match = code.match(/-(\d+)$/)
    if (!match) continue
    max = Math.max(max, Number.parseInt(match[1], 10))
  }

  return `EMP-${String(max + 1).padStart(4, "0")}`
}

/** Next EXT-#### from the highest EXT- numeric suffix among all provided codes. */
export function buildNextExternalEmployeeCode(existingCodes: string[]): string {
  let max = 0
  for (const code of existingCodes) {
    const match = /^EXT-(\d+)$/i.exec(code.trim())
    if (!match) continue
    const value = Number(match[1])
    if (Number.isFinite(value) && value > max) max = value
  }
  return `EXT-${String(max + 1).padStart(4, "0")}`
}
