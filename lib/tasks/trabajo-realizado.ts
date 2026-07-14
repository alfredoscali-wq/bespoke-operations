import type { Task } from "@/lib/types/tasks"

export const TRABAJO_REALIZADO_METADATA_KEY = "trabajoRealizado"

export function readTrabajoRealizadoFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const value = metadata?.[TRABAJO_REALIZADO_METADATA_KEY]
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

export function readTrabajoRealizadoFromTask(
  task: Pick<Task, "taskMetadata">
): string | null {
  return readTrabajoRealizadoFromMetadata(task.taskMetadata)
}

export function mergeTrabajoRealizadoIntoMetadata(
  existing: Record<string, unknown> | null | undefined,
  trabajoRealizado: string
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    [TRABAJO_REALIZADO_METADATA_KEY]: trabajoRealizado.trim(),
  }
}

export function validateTrabajoRealizado(
  value: unknown
): { ok: true; value: string } | { ok: false; message: string } {
  if (typeof value !== "string" || !value.trim()) {
    return {
      ok: false,
      message: "Debe completar el campo Trabajo Realizado antes de cerrar la OT.",
    }
  }

  return { ok: true, value: value.trim() }
}
