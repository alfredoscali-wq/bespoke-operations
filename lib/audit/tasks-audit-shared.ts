import type { Task } from "@/lib/types/tasks"

export function resolveTaskEntityLabel(
  task: Pick<Task, "code" | "title" | "workOrderNumber" | "id">
) {
  return (
    task.code?.trim() ||
    task.workOrderNumber?.trim() ||
    task.title?.trim() ||
    task.id
  )
}

export function buildTaskStatusMetadata(
  before: Pick<Task, "status">,
  after: Pick<Task, "status">
) {
  return {
    estado_anterior: before.status,
    estado_nuevo: after.status,
  }
}

export function buildTaskScheduleMetadata(
  before: Pick<Task, "dueDate" | "scheduledTime">,
  after: Pick<Task, "dueDate" | "scheduledTime">
) {
  return {
    fecha_anterior: before.dueDate,
    fecha_nueva: after.dueDate,
    hora_anterior: before.scheduledTime ?? null,
    hora_nueva: after.scheduledTime ?? null,
  }
}

export function buildTaskCrewMetadata(
  before: Pick<Task, "crew" | "crewId" | "supervisor">,
  after: Pick<Task, "crew" | "crewId" | "supervisor">
) {
  return {
    cuadrilla_anterior: before.crew?.trim() || before.crewId || null,
    cuadrilla_nueva: after.crew?.trim() || after.crewId || null,
    crewId_anterior: before.crewId ?? null,
    crewId_nuevo: after.crewId ?? null,
    supervisor_anterior: before.supervisor?.trim() || null,
    supervisor_nuevo: after.supervisor?.trim() || null,
  }
}

export function buildTaskVencidaAuditMetadata(
  task: Pick<Task, "status" | "dueDate" | "scheduledTime" | "crewId" | "crew">
) {
  const tieneCuadrilla = Boolean(task.crewId || task.crew?.trim())

  return {
    ...buildTaskStatusMetadata({ status: task.status }, { status: "vencida" }),
    fecha_anterior: task.dueDate,
    hora_anterior: task.scheduledTime ?? null,
    tiene_cuadrilla: tieneCuadrilla,
    automatic: true,
  }
}
