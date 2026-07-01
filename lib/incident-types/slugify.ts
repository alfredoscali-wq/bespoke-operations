export function slugifyIncidentTypeCode(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)

  return slug || "incidencia"
}

export function resolveUniqueIncidentTypeCode(
  baseName: string,
  existingCodes: string[]
): string {
  const base = slugifyIncidentTypeCode(baseName)
  const taken = new Set(existingCodes.map((code) => code.toLowerCase()))

  if (!taken.has(base)) {
    return base
  }

  let suffix = 2
  while (taken.has(`${base}-${suffix}`)) {
    suffix += 1
  }

  return `${base}-${suffix}`
}
