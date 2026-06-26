import { compareDateOnly } from "@/lib/dates/date-only"
import { isWorkOrderTask } from "@/lib/tasks/work-order"
import type { Task } from "@/lib/types/tasks"

export function getCustomerWorkOrderHistory(
  tasks: Task[],
  customerId: string
): Task[] {
  return tasks
    .filter(
      (task) => task.customerId === customerId && isWorkOrderTask(task)
    )
    .sort((left, right) => compareDateOnly(right.dueDate, left.dueDate))
}
