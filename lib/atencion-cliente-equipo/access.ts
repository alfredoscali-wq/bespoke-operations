export function canViewEquipoIndividualReport(
  roleCode: string | null | undefined
): boolean {
  return roleCode === "administrador"
}
