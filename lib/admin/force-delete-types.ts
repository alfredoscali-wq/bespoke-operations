export const FORCE_DELETE_ENTITY_TYPES = ["task", "project"] as const

export type ForceDeleteEntityType = (typeof FORCE_DELETE_ENTITY_TYPES)[number]

export function isForceDeleteEntityType(
  value: string | null | undefined
): value is ForceDeleteEntityType {
  return (
    typeof value === "string" &&
    (FORCE_DELETE_ENTITY_TYPES as readonly string[]).includes(value)
  )
}

export const FORCE_DELETE_CONFIRM_TEXT = "ELIMINAR"
