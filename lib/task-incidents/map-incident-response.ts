import type {
  IncidentResponse,
  IncidentSummary,
  TaskIncident,
} from "@/lib/types/task-incidents"
import type { TaskIncidentDetail } from "@/lib/types/supabase/task-incidents"

export function mapTaskIncidentToSummary(
  incident: TaskIncident
): IncidentSummary {
  return {
    id: incident.id,
    companyId: incident.companyId,
    taskId: incident.taskId,
    employeeId: incident.employeeId,
    crewId: incident.crewId,
    incidentTypeId: incident.incidentTypeId,
    status: incident.status,
    comment: incident.comment,
    canContinue: incident.canContinue,
    requiresSupervisorAction: incident.requiresSupervisorAction,
    resolvedBy: incident.resolvedBy,
    resolvedAt: incident.resolvedAt,
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
  }
}

export function mapTaskIncidentToResponse(
  incident: TaskIncidentDetail
): IncidentResponse {
  return {
    ...mapTaskIncidentToSummary(incident),
    photos: incident.photos,
    events: incident.events,
  }
}

export function mapTaskIncidentsToSummaries(
  incidents: TaskIncident[]
): IncidentSummary[] {
  return incidents.map(mapTaskIncidentToSummary)
}
