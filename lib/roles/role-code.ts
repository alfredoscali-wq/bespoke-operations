import { slugifyRoleCode } from "@/lib/roles/role-utils"

export function resolveUniqueRoleCode(
  name: string,
  existingCodes: string[]
): string {
  const base = slugifyRoleCode(name)
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
