import { MobileApiError } from "@/lib/mobile/v1/errors"

export type MobileProjectMapRequest = {
  projectId: string
  taskId: string
  deviceId: string
}

export function validateMobileProjectMapRequest(
  projectId: string,
  taskId: string | null,
  deviceId: string | null
): MobileProjectMapRequest {
  if (!projectId.trim()) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Identificador de obra inválido.",
      400
    )
  }

  if (!taskId?.trim()) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Parámetro requerido: taskId.",
      400
    )
  }

  if (!deviceId?.trim()) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Parámetro requerido: deviceId.",
      400
    )
  }

  return {
    projectId: projectId.trim(),
    taskId: taskId.trim(),
    deviceId: deviceId.trim(),
  }
}

export function resolveMobileProjectMapBinding(input: {
  taskProjectId?: string | null
  pathProjectId: string
}): { ok: true; projectId: string } | { ok: false } {
  const taskProjectId = input.taskProjectId?.trim() || ""
  const pathProjectId = input.pathProjectId.trim()
  if (!taskProjectId || !pathProjectId || taskProjectId !== pathProjectId) {
    return { ok: false }
  }
  return { ok: true, projectId: taskProjectId }
}

export function throwMobileProjectMapNotFound(): never {
  throw new MobileApiError(
    "TASK_NOT_FOUND",
    "Orden de trabajo no encontrada.",
    404
  )
}
