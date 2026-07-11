import { resolveUniqueCode, slugifyCode } from "@/lib/utils/code-slug"

export function slugifyEmployeeTypeCode(name: string): string {
  return slugifyCode(name, "tipo-empleado")
}

export function resolveUniqueEmployeeTypeCode(
  baseName: string,
  existingCodes: string[]
): string {
  return resolveUniqueCode(baseName, existingCodes, "tipo-empleado")
}
