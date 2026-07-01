export const INCIDENT_TYPE_DELETE_BLOCKED_MESSAGE =
  "No se puede eliminar este tipo de incidencia porque ya fue utilizado. Desactívelo para ocultarlo en nuevas incidencias."

export function canDeleteIncidentType(
  code: string,
  usageCount: number
): { allowed: true } | { allowed: false; message: string } {
  if (usageCount > 0) {
    return {
      allowed: false,
      message: INCIDENT_TYPE_DELETE_BLOCKED_MESSAGE,
    }
  }

  return { allowed: true }
}
