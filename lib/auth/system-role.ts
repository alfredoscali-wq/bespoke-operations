import type { SystemRole } from "@/lib/types/employees"

const SYSTEM_ROLES: SystemRole[] = [
  "administrador",
  "supervisor",
  "administrativo",
  "operario",
]

export function isSystemRole(value: unknown): value is SystemRole {
  return (
    typeof value === "string" &&
    SYSTEM_ROLES.includes(value as SystemRole)
  )
}

export function getMetadataSystemRole(
  metadata: Record<string, unknown> | undefined
): SystemRole | null {
  if (!metadata) return null
  return isSystemRole(metadata.system_role) ? metadata.system_role : null
}
