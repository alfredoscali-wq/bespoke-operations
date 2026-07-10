const RETENCION_SUPERVISION_ROLE_CODES = new Set([
  "administrador",
  "administracion",
])

export function canViewAssignedCustomerRetenciones(
  roleCode: string | null | undefined
): boolean {
  if (!roleCode) {
    return false
  }

  return RETENCION_SUPERVISION_ROLE_CODES.has(roleCode)
}

export function canMarkCustomerRetencionReadyForRetiro(
  roleCode: string | null | undefined
): boolean {
  return canViewAssignedCustomerRetenciones(roleCode)
}
