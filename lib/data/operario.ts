import { compareDateOnly, toLocalDateOnly } from "@/lib/dates/date-only"
import { sortTasksInExecutionSequence } from "@/lib/planificacion/planning-execution-order"
import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import type { Task, TaskStatus } from "@/lib/types/tasks"

export type WorkerCrewRef = {
  id?: string
  name: string
}

/** OT publicadas en jornada (asignadas), visibles para el operario. */
const OPERARIO_TODAY_SCHEDULED_STATUSES: TaskStatus[] = ["asignada"]

const OPERARIO_TODAY_OVERDUE_STATUSES: TaskStatus[] = ["vencida"]

const OPERARIO_TODAY_ACTIVE_STATUSES: TaskStatus[] = [
  "en-curso",
  "incidencia",
  "pendiente-cierre",
  "en-aprobacion",
]

const OPERARIO_HISTORY_STATUSES: TaskStatus[] = [
  "finalizada",
  "cerrada",
  "cancelada",
  "pendiente-cierre",
  "en-aprobacion",
  "incidencia",
]

function sortOperarioTodayTasks(tasks: Task[]): Task[] {
  return sortTasksInExecutionSequence(tasks)
}

export function isOperarioScheduledTaskVisibleToday(
  task: Pick<Task, "dueDate">,
  referenceDate: string = toLocalDateOnly()
): boolean {
  return compareDateOnly(task.dueDate, referenceDate) <= 0
}

export function isOperarioTodayTask(
  task: Task,
  referenceDate: string = toLocalDateOnly()
): boolean {
  if (OPERARIO_TODAY_ACTIVE_STATUSES.includes(task.status)) {
    return true
  }

  if (OPERARIO_TODAY_OVERDUE_STATUSES.includes(task.status)) {
    return true
  }

  if (OPERARIO_TODAY_SCHEDULED_STATUSES.includes(task.status)) {
    return isOperarioScheduledTaskVisibleToday(task, referenceDate)
  }

  return false
}

export function isOperarioHistoryTask(task: Task): boolean {
  return OPERARIO_HISTORY_STATUSES.includes(task.status)
}

export function sortOperarioTasksByDateDesc(tasks: Task[]): Task[] {
  return [...tasks].sort((left, right) =>
    compareDateOnly(right.dueDate, left.dueDate)
  )
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

export function getOperarioTodayTasks(
  tasks: Task[],
  workerCrew: WorkerCrewRef,
  referenceDate: string = toLocalDateOnly()
): Task[] {
  const todayTasks = getWorkerTasks(tasks, workerCrew).filter((task) =>
    isOperarioTodayTask(task, referenceDate)
  )

  return sortOperarioTodayTasks(todayTasks)
}

/** @deprecated Use getOperarioTodayTasks */
export function getTodayWorkerTasks(
  tasks: Task[],
  workerCrew: WorkerCrewRef,
  referenceDate: string = toLocalDateOnly()
): Task[] {
  return getOperarioTodayTasks(tasks, workerCrew, referenceDate)
}

export function getOperarioHistoryTasks(
  tasks: Task[],
  workerCrew: WorkerCrewRef
): Task[] {
  const historyTasks = getWorkerTasks(tasks, workerCrew).filter((task) =>
    isOperarioHistoryTask(task)
  )

  return sortOperarioTasksByDateDesc(historyTasks)
}

export function groupOperarioHistoryTasks(
  tasks: Task[],
  workerCrew: WorkerCrewRef
) {
  const historyTasks = getOperarioHistoryTasks(tasks, workerCrew)

  return {
    finalizadas: sortOperarioTasksByDateDesc(
      historyTasks.filter(
        (task) => task.status === "finalizada" || task.status === "cerrada"
      )
    ),
    pendientesCierre: sortOperarioTasksByDateDesc(
      historyTasks.filter(
        (task) =>
          task.status === "pendiente-cierre" || task.status === "en-aprobacion"
      )
    ),
    incidencias: sortOperarioTasksByDateDesc(
      historyTasks.filter((task) => task.status === "incidencia")
    ),
    canceladas: sortOperarioTasksByDateDesc(
      historyTasks.filter((task) => task.status === "cancelada")
    ),
    all: historyTasks,
  }
}

/** @deprecated Use groupOperarioHistoryTasks */
export function groupWorkerTasks(
  tasks: Task[],
  workerCrew: WorkerCrewRef,
  referenceDate: string = toLocalDateOnly()
) {
  void referenceDate

  return groupOperarioHistoryTasks(tasks, workerCrew)
}

export function isOperarioWorkerTaskAccessible(
  task: Task,
  workerCrew: WorkerCrewRef,
  referenceDate: string = toLocalDateOnly()
): boolean {
  if (!getWorkerTasks([task], workerCrew).length) {
    return false
  }

  return (
    isOperarioTodayTask(task, referenceDate) || isOperarioHistoryTask(task)
  )
}

export type OperarioTodaySummary = {
  total: number
  programadas: number
  vencidas: number
  enCurso: number
  pendientesCierre: number
  incidencias: number
}

export function summarizeOperarioTodayTasks(
  todayTasks: Task[]
): OperarioTodaySummary {
  return {
    total: todayTasks.length,
    programadas: todayTasks.filter((task) =>
      OPERARIO_TODAY_SCHEDULED_STATUSES.includes(task.status)
    ).length,
    vencidas: todayTasks.filter((task) => task.status === "vencida").length,
    enCurso: todayTasks.filter((task) => task.status === "en-curso").length,
    pendientesCierre: todayTasks.filter(
      (task) =>
        task.status === "pendiente-cierre" || task.status === "en-aprobacion"
    ).length,
    incidencias: todayTasks.filter((task) => task.status === "incidencia").length,
  }
}
