import { toDateOnly } from "@/lib/availability/utils"
import { compareDateOnly } from "@/lib/dates/date-only"
import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import type { Task, TaskStatus } from "@/lib/types/tasks"

export type WorkerCrewRef = {
  id?: string
  name: string
}

const OPERARIO_HOME_STATUSES: TaskStatus[] = [
  "pendiente",
  "asignada",
  "en-curso",
  "incidencia",
]

const OPERARIO_SCHEDULED_STATUSES: TaskStatus[] = ["pendiente", "asignada"]

const OPERARIO_ACTIVE_FIELD_STATUSES: TaskStatus[] = ["en-curso", "incidencia"]

export function isOperarioScheduledTaskVisibleToday(
  task: Pick<Task, "dueDate" | "startDate">,
  referenceDate: string = toDateOnly()
): boolean {
  if (compareDateOnly(task.dueDate, referenceDate) < 0) {
    return true
  }

  return task.dueDate === referenceDate || task.startDate === referenceDate
}

function isOperarioHomeTask(
  task: Task,
  referenceDate: string = toDateOnly()
): boolean {
  if (!OPERARIO_HOME_STATUSES.includes(task.status)) {
    return false
  }

  if (OPERARIO_ACTIVE_FIELD_STATUSES.includes(task.status)) {
    return true
  }

  return isOperarioScheduledTaskVisibleToday(task, referenceDate)
}

export function isOperarioWorkerTaskAccessible(
  task: Task,
  workerCrew: WorkerCrewRef,
  referenceDate: string = toDateOnly()
): boolean {
  if (!getWorkerTasks([task], workerCrew).length) {
    return false
  }

  if (OPERARIO_SCHEDULED_STATUSES.includes(task.status)) {
    return isOperarioScheduledTaskVisibleToday(task, referenceDate)
  }

  return true
}

export function getWorkerTasks(tasks: Task[], workerCrew: WorkerCrewRef): Task[] {
  const crewName = workerCrew.name.trim()
  if (!crewName && !workerCrew.id) {
    return []
  }

  const crewRef = { id: workerCrew.id ?? "", name: crewName }

  return tasks.filter((task) => {
    if (!task.crewId && !task.crew?.trim()) {
      return false
    }

    if (workerCrew.id) {
      return taskMatchesCrewId(task, crewRef)
    }

    const normalizedWorkerCrew = crewName.toLocaleLowerCase("es")
    const taskCrew = task.crew?.trim().toLocaleLowerCase("es")
    return Boolean(taskCrew && taskCrew === normalizedWorkerCrew)
  })
}

export function getTodayWorkerTasks(
  tasks: Task[],
  workerCrew: WorkerCrewRef,
  referenceDate: string = toDateOnly()
): Task[] {
  return getWorkerTasks(tasks, workerCrew).filter((task) =>
    isOperarioHomeTask(task, referenceDate)
  )
}

export function groupWorkerTasks(
  tasks: Task[],
  workerCrew: WorkerCrewRef,
  referenceDate: string = toDateOnly()
) {
  const workerTasks = getWorkerTasks(tasks, workerCrew)

  return {
    pendientes: workerTasks.filter(
      (task) =>
        OPERARIO_SCHEDULED_STATUSES.includes(task.status) &&
        isOperarioScheduledTaskVisibleToday(task, referenceDate)
    ),
    enCurso: workerTasks.filter(
      (task) =>
        task.status === "en-curso" ||
        task.status === "incidencia" ||
        task.status === "pendiente-cierre" ||
        task.status === "en-aprobacion"
    ),
    finalizadas: workerTasks.filter(
      (task) =>
        task.status === "finalizada" ||
        task.status === "cerrada" ||
        task.status === "cancelada"
    ),
    all: workerTasks,
  }
}
