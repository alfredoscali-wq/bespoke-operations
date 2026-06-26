import { AUDIT_ACTIONS } from "@/lib/audit/types"

type BuildAuditDescriptionInput = {
  action: string
  entityLabel?: string | null
  fallback?: string
}

export function buildAuditDescription(input: BuildAuditDescriptionInput): string {
  const label = input.entityLabel?.trim()
  const fallback = input.fallback?.trim()

  switch (input.action) {
    case AUDIT_ACTIONS.CUSTOMER_CREATE:
      return label ? `Cliente creado: ${label}.` : "Cliente creado."
    case AUDIT_ACTIONS.CUSTOMER_UPDATE:
      return label ? `Cliente editado: ${label}.` : "Cliente editado."
    case AUDIT_ACTIONS.CUSTOMER_VALIDATE:
      return label ? `Cliente validado: ${label}.` : "Cliente validado."
    case AUDIT_ACTIONS.CUSTOMER_ARCHIVE:
      return label ? `Cliente archivado: ${label}.` : "Cliente archivado."
    case AUDIT_ACTIONS.CUSTOMER_DELETE:
      return "Cliente eliminado (sin actividad operativa)."
    case AUDIT_ACTIONS.CUSTOMER_DELETE_PERMANENT:
      return label
        ? `Cliente eliminado definitivamente: ${label}.`
        : "Cliente eliminado definitivamente."
    case AUDIT_ACTIONS.TASK_CREATE:
      return label ? `OT creada: ${label}.` : "OT creada."
    case AUDIT_ACTIONS.TASK_UPDATE:
      return label ? `OT editada: ${label}.` : "OT editada."
    case AUDIT_ACTIONS.TASK_ASSIGN_CREW:
      return label ? `Cuadrilla asignada a OT: ${label}.` : "Cuadrilla asignada a OT."
    case AUDIT_ACTIONS.TASK_RESCHEDULE:
      return label ? `OT reprogramada: ${label}.` : "OT reprogramada."
    case AUDIT_ACTIONS.TASK_STATUS_VENCIDA:
      return label
        ? `OT marcada como Vencida automáticamente: ${label}.`
        : "OT marcada como Vencida automáticamente."
    case AUDIT_ACTIONS.TASK_STATUS_EN_CURSO:
      return label ? `OT iniciada (En curso): ${label}.` : "OT iniciada (En curso)."
    case AUDIT_ACTIONS.TASK_REQUEST_CLOSE:
      return label
        ? `Solicitud de cierre de OT: ${label}.`
        : "Solicitud de cierre de OT."
    case AUDIT_ACTIONS.TASK_FINISH:
      return label ? `OT finalizada: ${label}.` : "OT finalizada."
    case AUDIT_ACTIONS.TASK_CLOSE:
      return label ? `OT cerrada: ${label}.` : "OT cerrada."
    case AUDIT_ACTIONS.TASK_DELETE:
      return label ? `OT eliminada: ${label}.` : "OT eliminada."
    case AUDIT_ACTIONS.TASK_DELETE_PERMANENT:
      return label
        ? `OT eliminada definitivamente: ${label}.`
        : "OT eliminada definitivamente."
    case AUDIT_ACTIONS.PROJECT_CREATE:
      return label ? `Obra creada: ${label}.` : "Obra creada."
    case AUDIT_ACTIONS.PROJECT_UPDATE:
      return label ? `Obra editada: ${label}.` : "Obra editada."
    case AUDIT_ACTIONS.PROJECT_STATUS_CHANGE:
      return label ? `Cambio de estado de obra: ${label}.` : "Cambio de estado de obra."
    case AUDIT_ACTIONS.PROJECT_ARCHIVE:
      return label ? `Obra archivada: ${label}.` : "Obra archivada."
    case AUDIT_ACTIONS.PROJECT_DELETE_PERMANENT:
      return label
        ? `Obra eliminada definitivamente: ${label}.`
        : "Obra eliminada definitivamente."
    case AUDIT_ACTIONS.EMPLOYEE_CREATE:
      return label ? `Alta de empleado: ${label}.` : "Alta de empleado."
    case AUDIT_ACTIONS.EMPLOYEE_UPDATE:
      return label ? `Empleado editado: ${label}.` : "Empleado editado."
    case AUDIT_ACTIONS.EMPLOYEE_DEACTIVATE:
      return label ? `Baja de empleado: ${label}.` : "Baja de empleado."
    case AUDIT_ACTIONS.EMPLOYEE_REACTIVATE:
      return label ? `Empleado reactivado: ${label}.` : "Empleado reactivado."
    case AUDIT_ACTIONS.CREW_CREATE:
      return label ? `Cuadrilla creada: ${label}.` : "Cuadrilla creada."
    case AUDIT_ACTIONS.CREW_UPDATE:
      return label ? `Cuadrilla editada: ${label}.` : "Cuadrilla editada."
    case AUDIT_ACTIONS.CREW_ARCHIVE:
      return label ? `Cuadrilla archivada: ${label}.` : "Cuadrilla archivada."
    case AUDIT_ACTIONS.CREW_MEMBER_ADD:
      return label
        ? `Operario agregado a cuadrilla: ${label}.`
        : "Operario agregado a cuadrilla."
    case AUDIT_ACTIONS.CREW_MEMBER_REMOVE:
      return label
        ? `Operario removido de cuadrilla: ${label}.`
        : "Operario removido de cuadrilla."
    case AUDIT_ACTIONS.AVAILABILITY_CHANGE:
      return label
        ? `Cambio de disponibilidad: ${label}.`
        : "Cambio de disponibilidad."
    case AUDIT_ACTIONS.USER_LOGIN:
      return label ? `Inicio de sesión: ${label}.` : "Inicio de sesión."
    case AUDIT_ACTIONS.USER_LOGOUT:
      return label ? `Cierre de sesión: ${label}.` : "Cierre de sesión."
    case AUDIT_ACTIONS.USER_CREATE:
      return label ? `Usuario creado: ${label}.` : "Usuario creado."
    case AUDIT_ACTIONS.USER_PROVISION:
      return label ? `Acceso provisionado: ${label}.` : "Acceso provisionado."
    case AUDIT_ACTIONS.USER_DEACTIVATE:
      return label ? `Usuario desactivado: ${label}.` : "Usuario desactivado."
    case AUDIT_ACTIONS.USER_REACTIVATE:
      return label ? `Usuario reactivado: ${label}.` : "Usuario reactivado."
    case AUDIT_ACTIONS.USER_PASSWORD_RESET:
      return label ? `Reset de contraseña: ${label}.` : "Reset de contraseña."
    case AUDIT_ACTIONS.USER_ROLE_CHANGE:
      return label ? `Cambio de rol: ${label}.` : "Cambio de rol."
    default:
      return fallback || "Evento registrado en Historial del Sistema."
  }
}
