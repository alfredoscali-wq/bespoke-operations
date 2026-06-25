import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import type { Task } from "@/lib/types/tasks"

export type WorkerCrewRef = {
  id?: string
  name: string
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
  workerCrew: WorkerCrewRef
): Task[] {
  return getWorkerTasks(tasks, workerCrew).filter(
    (task) =>
      task.status === "pendiente" ||
      task.status === "asignada" ||
      task.status === "en-curso" ||
      task.status === "incidencia"
  )
}

export function groupWorkerTasks(tasks: Task[], workerCrew: WorkerCrewRef) {
  const workerTasks = getWorkerTasks(tasks, workerCrew)

  return {
    pendientes: workerTasks.filter(
      (task) => task.status === "pendiente" || task.status === "asignada"
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
