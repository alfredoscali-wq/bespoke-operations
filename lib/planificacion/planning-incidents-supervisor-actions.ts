import type { TaskIncidentStatus } from "../types/task-incidents"
import type { TaskStatus } from "../types/tasks"

const ACTIVE_TASK_INCIDENT_STATUSES: TaskIncidentStatus[] = [
  "REPORTADA",
  "EN_ANALISIS",
]

export type ContinueIncidentSupervisorPlan = {
  modifiesTaskStatus: false
  incidentEventType: "CONTINUE"
  incidentEventComment: string
  nextIncidentStatus: "RESUELTA"
  canContinue: true
}

/**
 * RC3.1: resolving an active incident does not change the OT workflow.
 * The supervisor "Continuar" action only closes the incident expediente.
 */
export function buildContinueIncidentSupervisorPlan(): ContinueIncidentSupervisorPlan {
  return {
    modifiesTaskStatus: false,
    incidentEventType: "CONTINUE",
    incidentEventComment: "El supervisor autorizó continuar la ejecución.",
    nextIncidentStatus: "RESUELTA",
    canContinue: true,
  }
}

export type SupervisorRescheduleDiagnosis =
  | {
      allowed: true
      workflowAction:
        | "reschedule-from-incident"
        | "reschedule-from-overdue"
        | "reschedule-from-active-incident"
    }
  | {
      allowed: false
      reason: string
      blockedBy: "legacy-workflow" | "db-status-transition"
    }

/**
 * Documents which OT statuses can use each reschedule path.
 *
 * RC3.1 keeps active incidents on OT `en-curso` and uses the protected
 * server-side flow `reschedule-from-active-incident`.
 */
export function diagnoseSupervisorRescheduleFromTaskStatus(
  taskStatus: TaskStatus
): SupervisorRescheduleDiagnosis {
  if (taskStatus === "incidencia") {
    return { allowed: true, workflowAction: "reschedule-from-incident" }
  }

  if (taskStatus === "vencida") {
    return { allowed: true, workflowAction: "reschedule-from-overdue" }
  }

  if (taskStatus === "en-curso") {
    return {
      allowed: true,
      workflowAction: "reschedule-from-active-incident",
    }
  }

  return {
    allowed: false,
    blockedBy: "legacy-workflow",
    reason: `No existe un flujo de replanificación reutilizable para OT en estado ${taskStatus}.`,
  }
}

export function countActiveTaskIncidentsForMetrics(
  incidents: ReadonlyArray<{ status: TaskIncidentStatus; companyId?: string }>,
  companyId?: string
): number {
  return incidents.filter((incident) => {
    if (companyId && incident.companyId && incident.companyId !== companyId) {
      return false
    }

    return ACTIVE_TASK_INCIDENT_STATUSES.includes(incident.status)
  }).length
}
