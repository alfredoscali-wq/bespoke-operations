import type { ChecklistItem, Task, TaskStatus } from "@/lib/types/tasks"

export function getChecklistProgress(checklist: ChecklistItem[]): number {
  if (checklist.length === 0) return 0
  const completed = checklist.filter((item) => item.completed).length
  return Math.round((completed / checklist.length) * 100)
}

export function getRequiredChecklistComplete(checklist: ChecklistItem[]): boolean {
  return checklist.filter((item) => item.required).every((item) => item.completed)
}

export function getIncompleteRequiredItems(checklist: ChecklistItem[]): ChecklistItem[] {
  return checklist.filter((item) => item.required && !item.completed)
}

export function canMoveToStatus(
  task: Task,
  newStatus: TaskStatus
): { allowed: boolean; message?: string } {
  if (newStatus === "finalizada" && !getRequiredChecklistComplete(task.checklist)) {
    const missing = getIncompleteRequiredItems(task.checklist)
      .map((item) => item.label)
      .join(", ")

    return {
      allowed: false,
      message: `No se puede marcar como Finalizada. Complete los elementos obligatorios: ${missing}.`,
    }
  }

  return { allowed: true }
}

export function syncTaskProgress(task: Task): Task {
  const progress = getChecklistProgress(task.checklist)
  return { ...task, progress }
}
