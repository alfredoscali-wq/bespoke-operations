import type { Task, TaskType } from "@/lib/types/tasks"
import {
  WORK_ORDER_SERVICE_TYPE_OPTIONS,
  type WorkOrderServiceType,
} from "@/lib/tasks/work-order"

export const WORK_ORDER_OT_TYPE_FILTER_OBRA = "obra" as const
export const WORK_ORDER_OT_TYPE_FILTER_MAINTENANCE = "mantenimiento" as const

export type WorkOrderOtTypeFilterValue =
  | "all"
  | WorkOrderServiceType
  | typeof WORK_ORDER_OT_TYPE_FILTER_OBRA
  | typeof WORK_ORDER_OT_TYPE_FILTER_MAINTENANCE

export const ARCHIVE_OT_TYPE_FILTER_OPTIONS: Array<{
  value: WorkOrderOtTypeFilterValue
  label: string
}> = [
  { value: "all", label: "Todas" },
  ...WORK_ORDER_SERVICE_TYPE_OPTIONS,
  {
    value: WORK_ORDER_OT_TYPE_FILTER_MAINTENANCE,
    label: "Mantenimiento",
  },
  { value: WORK_ORDER_OT_TYPE_FILTER_OBRA, label: "Obra" },
]

export function taskMatchesWorkOrderOtTypeFilter(
  task: Pick<Task, "projectId" | "serviceType" | "type">,
  filter: WorkOrderOtTypeFilterValue
): boolean {
  if (filter === "all") {
    return true
  }

  if (filter === WORK_ORDER_OT_TYPE_FILTER_OBRA) {
    return Boolean(task.projectId)
  }

  if (filter === WORK_ORDER_OT_TYPE_FILTER_MAINTENANCE) {
    return task.type === ("maintenance" satisfies TaskType)
  }

  return task.serviceType === filter
}
