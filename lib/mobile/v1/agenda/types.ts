import type { TaskPriority, TaskStatus, TaskType } from "@/lib/types/tasks"

export type MobileAgendaTaskItem = {
  id: string
  workOrderNumber: string | null
  workType: string
  taskType: TaskType
  status: TaskStatus
  priority: TaskPriority
  date: string
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
}

export type MobileAgendaTodayResponse = {
  shiftActive: boolean
  workTeamId: string
  workTeamName: string
  items: MobileAgendaTaskItem[]
}
