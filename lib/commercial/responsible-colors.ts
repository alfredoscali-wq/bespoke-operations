/**
 * Stable responsible colors for Territorio Comercial.
 * Color is derived from assignedEmployeeId (never creator), via a fixed palette.
 */

export type CommercialResponsibleColor = {
  id: string
  hex: string
  /** Soft background for pills/list accents. */
  soft: string
  label: string
}

export const COMMERCIAL_UNASSIGNED_RESPONSIBLE_COLOR: CommercialResponsibleColor =
  {
    id: "unassigned",
    hex: "#94a3b8",
    soft: "#f1f5f9",
    label: "Gris",
  }

/** Fixed palette — order is stable; assignment uses hash(employeeId) % length. */
export const COMMERCIAL_RESPONSIBLE_COLOR_PALETTE: readonly CommercialResponsibleColor[] =
  [
    { id: "blue", hex: "#2563eb", soft: "#dbeafe", label: "Azul" },
    { id: "green", hex: "#16a34a", soft: "#dcfce7", label: "Verde" },
    { id: "violet", hex: "#7c3aed", soft: "#ede9fe", label: "Violeta" },
    { id: "orange", hex: "#ea580c", soft: "#ffedd5", label: "Naranja" },
    { id: "rose", hex: "#e11d48", soft: "#ffe4e6", label: "Rosa" },
    { id: "cyan", hex: "#0891b2", soft: "#cffafe", label: "Cian" },
    { id: "amber", hex: "#d97706", soft: "#fef3c7", label: "Ámbar" },
    { id: "indigo", hex: "#4f46e5", soft: "#e0e7ff", label: "Índigo" },
    { id: "teal", hex: "#0d9488", soft: "#ccfbf1", label: "Teal" },
    { id: "fuchsia", hex: "#c026d3", soft: "#fae8ff", label: "Fucsia" },
  ] as const

function hashEmployeeId(employeeId: string): number {
  let hash = 2166136261
  for (let index = 0; index < employeeId.length; index += 1) {
    hash ^= employeeId.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function resolveCommercialResponsibleColor(
  assignedEmployeeId: string | null | undefined
): CommercialResponsibleColor {
  const id = assignedEmployeeId?.trim() ?? ""
  if (!id) return COMMERCIAL_UNASSIGNED_RESPONSIBLE_COLOR
  const palette = COMMERCIAL_RESPONSIBLE_COLOR_PALETTE
  const index = hashEmployeeId(id) % palette.length
  return palette[index] ?? COMMERCIAL_UNASSIGNED_RESPONSIBLE_COLOR
}

export function resolveCommercialResponsibleShortName(
  fullName: string | null | undefined
): string {
  const trimmed = fullName?.trim() ?? ""
  if (!trimmed) return "Sin responsable"
  const first = trimmed.split(/\s+/)[0]
  return first || trimmed
}

export type CommercialResponsibleLegendItem = {
  key: string
  employeeId: string | null
  name: string
  shortName: string
  count: number
  color: CommercialResponsibleColor
}

export function buildCommercialResponsibleLegend(
  opportunities: Array<{ assignedEmployeeId: string | null }>,
  employeeNameById: Record<string, string>
): CommercialResponsibleLegendItem[] {
  const counts = new Map<string, number>()

  for (const opportunity of opportunities) {
    const key = opportunity.assignedEmployeeId?.trim() || "__unassigned__"
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const items: CommercialResponsibleLegendItem[] = []

  for (const [key, count] of counts.entries()) {
    const employeeId = key === "__unassigned__" ? null : key
    const name = employeeId
      ? employeeNameById[employeeId]?.trim() || "Responsable"
      : "Sin responsable"
    const color = resolveCommercialResponsibleColor(employeeId)
    items.push({
      key,
      employeeId,
      name,
      shortName: resolveCommercialResponsibleShortName(
        employeeId ? name : "Sin responsable"
      ),
      count,
      color,
    })
  }

  items.sort((left, right) => {
    if (left.employeeId === null) return 1
    if (right.employeeId === null) return -1
    return left.name.localeCompare(right.name, "es", { sensitivity: "base" })
  })

  return items
}
