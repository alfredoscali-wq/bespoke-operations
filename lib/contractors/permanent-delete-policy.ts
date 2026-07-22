export const CONTRACTOR_PERMANENT_DELETE_CONFIRM_TEXT = "ELIMINAR"

export const CONTRACTOR_PERMANENT_DELETE_ADMIN_ONLY_MESSAGE =
  "Solo un Administrador puede eliminar definitivamente un contratista."

export function canShowContractorPermanentDeleteAction(
  systemRole: string | null | undefined
): boolean {
  return systemRole === "administrador"
}
