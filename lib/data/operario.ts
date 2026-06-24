import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"

export type OperarioNotificationType =
  | "task-assigned"
  | "comment-received"
  | "task-approved"
  | "task-rejected"

export type OperarioNotification = {
  id: string
  type: OperarioNotificationType
  title: string
  message: string
  timestamp: string
  read: boolean
  taskId?: string
}

/** Temporary crew name until Fase 2 resolves crew from crew_members. */
export const TEMP_OPERARIO_CREW_NAME = "SUR"

export type WorkerCrewRef = {
  id?: string
  name: string
}

export function resolveWorkerCrewRef(
  crewName: string,
  crews: Pick<Crew, "id" | "name">[] = []
): WorkerCrewRef {
  const normalizedWorkerCrew = crewName.trim().toLocaleLowerCase("es")
  const matchedCrew = crews.find(
    (crew) => crew.name.trim().toLocaleLowerCase("es") === normalizedWorkerCrew
  )

  return {
    id: matchedCrew?.id,
    name: crewName,
  }
}

export const mockNotifications: OperarioNotification[] = [
  {
    id: "notif-1",
    type: "task-assigned",
    title: "Nueva tarea asignada",
    message: "Nueva OT asignada a su cuadrilla.",
    timestamp: "2026-06-12T07:30:00",
    read: false,
  },
  {
    id: "notif-2",
    type: "comment-received",
    title: "Comentario recibido",
    message: "Ing. Ana Torres: Verificar alineación de la cámara.",
    timestamp: "2026-06-12T09:00:00",
    read: false,
  },
  {
    id: "notif-3",
    type: "task-approved",
    title: "Tarea aprobada",
    message: "Una tarea de su cuadrilla fue aprobada por supervisión.",
    timestamp: "2026-06-10T16:00:00",
    read: true,
  },
  {
    id: "notif-4",
    type: "task-rejected",
    title: "Evidencia rechazada",
    message: "Ajuste la evidencia y vuelva a solicitar cierre.",
    timestamp: "2026-06-09T11:30:00",
    read: true,
  },
]

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
      task.status === "en-curso"
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
