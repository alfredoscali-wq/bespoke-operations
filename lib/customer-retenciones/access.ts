const RETENCION_ASSIGN_ROLE_CODES = new Set(["administrador", "administracion"])

export function canAssignCustomerRetencion(
  roleCode: string | null | undefined
): boolean {
  if (!roleCode) {
    return false
  }

  return RETENCION_ASSIGN_ROLE_CODES.has(roleCode)
}

export function canViewAssignedCustomerRetenciones(
  roleCode: string | null | undefined
): boolean {
  return canAssignCustomerRetencion(roleCode)
}
