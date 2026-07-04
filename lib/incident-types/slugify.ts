import { resolveUniqueCode, slugifyCode } from "@/lib/utils/code-slug"

export function slugifyIncidentTypeCode(name: string): string {
  return slugifyCode(name, "incidencia")
}

export function resolveUniqueIncidentTypeCode(
  baseName: string,
  existingCodes: string[]
): string {
  return resolveUniqueCode(baseName, existingCodes, "incidencia")
}
