import type { Task } from "@/lib/types/tasks"
import { shouldAutoTransitionToVencida } from "@/lib/tasks/vencida-status"

type SyncVencidaApiSuccess = {
  success: true
  updatedTaskIds: string[]
}

type SyncVencidaApiFailure = {
  success: false
  message?: string
}

type SyncVencidaApiResponse = SyncVencidaApiSuccess | SyncVencidaApiFailure

function isSyncVencidaFailure(
  body: SyncVencidaApiResponse
): body is SyncVencidaApiFailure {
  return !body.success
}

export type VencidaSyncResult = {
  tasks: Task[]
  candidateCount: number
  updatedTaskIds: string[]
  ok: boolean
  httpStatus?: number
  message?: string
}

export async function applyVencidaSyncFromApi(
  tasks: Task[]
): Promise<Task[]> {
  const result = await applyVencidaSyncFromApiDetailed(tasks)
  return result.tasks
}

export async function applyVencidaSyncFromApiDetailed(
  tasks: Task[]
): Promise<VencidaSyncResult> {
  const candidates = tasks.filter(shouldAutoTransitionToVencida)

  if (candidates.length === 0) {
    return {
      tasks,
      candidateCount: 0,
      updatedTaskIds: [],
      ok: true,
    }
  }

  try {
    const response = await fetch("/api/tasks/sync-vencida", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        taskIds: candidates.map((task) => task.id),
      }),
    })

    const body = (await response.json()) as SyncVencidaApiResponse

    if (!response.ok || isSyncVencidaFailure(body)) {
      const message = isSyncVencidaFailure(body)
        ? body.message ?? "No se pudo sincronizar el estado Vencida."
        : "No se pudo sincronizar el estado Vencida."

      console.warn("[TASK VENCIDA SYNC]", {
        httpStatus: response.status,
        message,
        candidateIds: candidates.map((task) => task.id),
        body,
      })

      return {
        tasks,
        candidateCount: candidates.length,
        updatedTaskIds: [],
        ok: false,
        httpStatus: response.status,
        message,
      }
    }

    const updatedIds = new Set(body.updatedTaskIds)

    if (body.updatedTaskIds.length > 0) {
      console.info("[TASK VENCIDA SYNC]", {
        httpStatus: response.status,
        updatedTaskIds: body.updatedTaskIds,
        candidateCount: candidates.length,
      })
    }

    return {
      tasks: tasks.map((task) =>
        updatedIds.has(task.id) ? { ...task, status: "vencida" } : task
      ),
      candidateCount: candidates.length,
      updatedTaskIds: body.updatedTaskIds,
      ok: true,
      httpStatus: response.status,
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Error de red al sincronizar Vencida."

    console.warn("[TASK VENCIDA SYNC]", {
      message,
      candidateIds: candidates.map((task) => task.id),
      error,
    })

    return {
      tasks,
      candidateCount: candidates.length,
      updatedTaskIds: [],
      ok: false,
      message,
    }
  }
}
