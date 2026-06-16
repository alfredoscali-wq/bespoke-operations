import type { ProjectHistoryRow } from "@/lib/supabase/database.types"
import type {
  ProjectHistoryEvent,
  ProjectHistoryEventType,
} from "@/lib/types/projects"

export function mapProjectHistoryRowToEvent(
  row: ProjectHistoryRow
): ProjectHistoryEvent {
  return {
    id: row.id,
    eventType: row.event_type as ProjectHistoryEventType,
    title: row.title,
    description: row.description,
    user: row.created_by ?? "Coordinación operativa",
    timestamp: row.created_at,
    metadata: (row.metadata ?? {}) as Record<string, string>,
  }
}

export function mapProjectHistoryEventToInsert(
  projectId: string,
  event: ProjectHistoryEvent
) {
  return {
    project_id: projectId,
    event_type: event.eventType,
    title: event.title,
    description: event.description,
    metadata: event.metadata ?? {},
    created_by: event.user,
    created_at: event.timestamp,
  }
}
