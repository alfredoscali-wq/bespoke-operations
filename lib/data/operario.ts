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

export const FIELD_WORKER = {
  id: "worker-juan",
  name: "Juan Pérez",
  initials: "JP",
  crew: "Cuadrilla Bravo",
  position: "Técnico de Campo",
  role: "Técnico de Instalación CCTV",
  phone: "+52 442 847 9031",
  supervisor: "Ing. Ana Torres",
} as const

export const JUAN_ASSIGNED_TASK_IDS = ["task-003", "task-016"] as const

export const mockNotifications: OperarioNotification[] = [
  {
    id: "notif-1",
    type: "task-assigned",
    title: "Nueva tarea asignada",
    message: "TSK-003 — Instalación cámara PTZ acceso norte",
    timestamp: "2026-06-12T07:30:00",
    read: false,
    taskId: "task-003",
  },
  {
    id: "notif-2",
    type: "comment-received",
    title: "Comentario recibido",
    message: "Ing. Ana Torres: Verificar alineación de la cámara.",
    timestamp: "2026-06-12T09:00:00",
    read: false,
    taskId: "task-003",
  },
  {
    id: "notif-3",
    type: "task-approved",
    title: "Tarea aprobada",
    message: "TSK-016 — Cableado estructurado aprobado por supervisión.",
    timestamp: "2026-06-10T16:00:00",
    read: true,
    taskId: "task-016",
  },
  {
    id: "notif-4",
    type: "task-rejected",
    title: "Evidencia rechazada",
    message: "TSK-003 — Ajustar ángulo de la cámara y volver a cargar fotos.",
    timestamp: "2026-06-09T11:30:00",
    read: true,
    taskId: "task-003",
  },
]

export function getWorkerTasks(tasks: Task[]): Task[] {
  return tasks.filter((task) =>
    JUAN_ASSIGNED_TASK_IDS.includes(
      task.id as (typeof JUAN_ASSIGNED_TASK_IDS)[number]
    )
  )
}

export function getTodayWorkerTasks(tasks: Task[]): Task[] {
  return getWorkerTasks(tasks).filter(
    (task) =>
      task.status === "pendiente" ||
      task.status === "asignada" ||
      task.status === "en-curso"
  )
}

export function groupWorkerTasks(tasks: Task[]) {
  const workerTasks = getWorkerTasks(tasks)

  return {
    pendientes: workerTasks.filter(
      (task) => task.status === "pendiente" || task.status === "asignada"
    ),
    enCurso: workerTasks.filter((task) => task.status === "en-curso"),
    finalizadas: workerTasks.filter(
      (task) =>
        task.status === "finalizada" ||
        task.status === "en-aprobacion" ||
        task.status === "cerrada" ||
        task.status === "cancelada"
    ),
    all: workerTasks,
  }
}
