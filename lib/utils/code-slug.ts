export function slugifyCode(name: string, fallback: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)

  return slug || fallback
}

export function resolveUniqueCode(
  baseName: string,
  existingCodes: string[],
  fallback: string
): string {
  const base = slugifyCode(baseName, fallback)
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
