import type { TaskPriority, TaskStatus, TaskType } from "@/lib/types/tasks"

export type MobileAgendaTaskItem = {
  id: string
  workOrderNumber: string | null
  workType: string
  taskType: TaskType
  status: TaskStatus
  priority: TaskPriority
  /** due_date (YYYY-MM-DD) — kept for backward compatibility */
  date: string
  /** start_date (YYYY-MM-DD); falls back to date when absent */
  startDate: string
  scheduledTime: string | null
  customerOrAssetName: string
  address: string
  locality: string | null
  summaryObservations: string | null
  amountToCollect: number | null
  latitude: number | null
  longitude: number | null
  executionOrder: number | null
  dispatchOrder: number | null
  hasActiveIncident: boolean
  /** True when the OT belongs to an Obra (projectId set). */
  isProjectTask: boolean
  projectId: string | null
  projectName: string | null
  /** Preformatted date range for mobile cards. */
  dateLabel: string
  /** "OT de Obra" / "Obra: {name}" when isProjectTask; otherwise null. */
  obraLabel: string | null
  /** OPS 2.1B — "Día X de Y" for multi-day Obra; null otherwise. */
  dayLabel: string | null
  dayIndex: number | null
  daySpan: number | null
}

export type MobileAgendaTodayResponse = {
  shiftActive: boolean
  workTeamId: string
  workTeamName: string
  items: MobileAgendaTaskItem[]
}
