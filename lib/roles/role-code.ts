import { resolveUniqueCode } from "@/lib/utils/code-slug"

export function resolveUniqueRoleCode(
  name: string,
  existingCodes: string[]
): string {
  return resolveUniqueCode(name, existingCodes, "rol")
}
