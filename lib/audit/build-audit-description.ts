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
    case AUDIT_ACTIONS.CUSTOMER_ACTIVATE:
      return label ? `Cliente activado: ${label}.` : "Cliente activado."
    case AUDIT_ACTIONS.CUSTOMER_ARCHIVE:
      return label ? `Cliente archivado: ${label}.` : "Cliente archivado."
    case AUDIT_ACTIONS.CUSTOMER_DELETE:
      return "Cliente eliminado (sin actividad operativa)."
    case AUDIT_ACTIONS.CUSTOMER_DELETE_PERMANENT:
      return label
        ? `Cliente eliminado definitivamente: ${label}.`
        : "Cliente eliminado definitivamente."
    case AUDIT_ACTIONS.TASK_CREATE:
      return label
        ? `Orden de trabajo creada: ${label}.`
        : "Orden de trabajo creada."
    case AUDIT_ACTIONS.TASK_UPDATE:
      return label
        ? `Orden de trabajo editada: ${label}.`
        : "Orden de trabajo editada."
    case AUDIT_ACTIONS.TASK_ASSIGN_CREW:
      return label
        ? `Cuadrilla asignada a orden de trabajo: ${label}.`
        : "Cuadrilla asignada a orden de trabajo."
    case AUDIT_ACTIONS.TASK_RESCHEDULE:
      return label
        ? `Orden de trabajo reprogramada: ${label}.`
        : "Orden de trabajo reprogramada."
    case AUDIT_ACTIONS.TASK_STATUS_VENCIDA:
      return label
        ? `Orden de trabajo marcada como Vencida automáticamente: ${label}.`
        : "Orden de trabajo marcada como Vencida automáticamente."
    case AUDIT_ACTIONS.TASK_STATUS_EN_CURSO:
      return label
        ? `Orden de trabajo iniciada (En curso): ${label}.`
        : "Orden de trabajo iniciada (En curso)."
    case AUDIT_ACTIONS.TASK_REQUEST_CLOSE:
      return label
        ? `Solicitud de cierre de orden de trabajo: ${label}.`
        : "Solicitud de cierre de orden de trabajo."
    case AUDIT_ACTIONS.TASK_FINISH:
      return label
        ? `Orden de trabajo finalizada: ${label}.`
        : "Orden de trabajo finalizada."
    case AUDIT_ACTIONS.TASK_CLOSE:
      return label
        ? `Orden de trabajo cerrada: ${label}.`
        : "Orden de trabajo cerrada."
    case AUDIT_ACTIONS.TASK_DELETE:
      return label
        ? `Orden de trabajo eliminada: ${label}.`
        : "Orden de trabajo eliminada."
    case AUDIT_ACTIONS.TASK_DELETE_PERMANENT:
      return label
        ? `Orden de trabajo eliminada definitivamente: ${label}.`
        : "Orden de trabajo eliminada definitivamente."
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
