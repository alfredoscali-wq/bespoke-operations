export const FORCE_DELETE_ADMIN_ONLY_MESSAGE =
  "Solo un administrador del sistema puede forzar la eliminación de un registro."

export const FORCE_DELETE_NOT_FOUND_MESSAGE =
  "El registro no existe o ya fue eliminado."

export function canShowForceDeleteAction(
  systemRole: string | null | undefined
): boolean {
  return systemRole === "administrador"
}
