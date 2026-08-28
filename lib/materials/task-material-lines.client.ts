import type {
  CreateTaskMaterialLinePayload,
  UpdateTaskMaterialLinePayload,
} from "@/lib/types/supabase/task-material-lines"
import type { TaskMaterialLineDraft, TaskMaterialLineView } from "@/lib/types/materials"

type ApiErrorBody = {
  success?: boolean
  message?: string
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody
    return body.message ?? "No se pudo completar la operación."
  } catch {
    return "No se pudo completar la operación."
  }
}

export async function fetchTaskMaterialLinesClient(
  taskId: string
): Promise<TaskMaterialLineView[]> {
  const response = await fetch(`/api/tasks/${taskId}/material-lines`, {
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }
  const body = (await response.json()) as {
    success: boolean
    lines: TaskMaterialLineView[]
  }
  return body.lines ?? []
}

export async function createTaskMaterialLineClient(
  taskId: string,
  payload: CreateTaskMaterialLinePayload
): Promise<TaskMaterialLineView> {
  const response = await fetch(`/api/tasks/${taskId}/material-lines`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }
  const body = (await response.json()) as {
    success: boolean
    line: TaskMaterialLineView
  }
  return body.line
}

export async function updateTaskMaterialLineClient(
  taskId: string,
  lineId: string,
  payload: UpdateTaskMaterialLinePayload
): Promise<TaskMaterialLineView> {
  const response = await fetch(
    `/api/tasks/${taskId}/material-lines/${lineId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }
  const body = (await response.json()) as {
    success: boolean
    line: TaskMaterialLineView
  }
  return body.line
}

export async function deleteTaskMaterialLineClient(
  taskId: string,
  lineId: string
): Promise<void> {
  const response = await fetch(
    `/api/tasks/${taskId}/material-lines/${lineId}`,
    { method: "DELETE" }
  )
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }
}

export type TaskMaterialLineEditorRow =
  | (TaskMaterialLineView & { kind: "persisted" })
  | (TaskMaterialLineDraft & { kind: "draft" })

export function buildDraftLineKey(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function syncTaskMaterialLinesClient(input: {
  taskId: string
  desiredRows: TaskMaterialLineEditorRow[]
  existingLines: TaskMaterialLineView[]
}): Promise<TaskMaterialLineView[]> {
  const { taskId, desiredRows, existingLines } = input
  const desiredPersistedIds = new Set(
    desiredRows
      .filter((row): row is TaskMaterialLineView & { kind: "persisted" } =>
        row.kind === "persisted"
      )
      .map((row) => row.id)
  )

  for (const existing of existingLines) {
    if (!desiredPersistedIds.has(existing.id)) {
      await deleteTaskMaterialLineClient(taskId, existing.id)
    }
  }

  const nextLines: TaskMaterialLineView[] = []

  for (const row of desiredRows) {
    if (row.kind === "draft") {
      const created = await createTaskMaterialLineClient(taskId, {
        materialId: row.materialId,
        warehouseId: row.warehouseId,
        quantityPlanned: row.quantityPlanned,
        notes: row.notes,
      })
      nextLines.push(created)
      continue
    }

    const previous = existingLines.find((line) => line.id === row.id)
    const changed =
      !previous ||
      previous.warehouseId !== row.warehouseId ||
      previous.quantityPlanned !== row.quantityPlanned ||
      (previous.notes ?? "") !== (row.notes ?? "")

    if (changed) {
      const updated = await updateTaskMaterialLineClient(taskId, row.id, {
        warehouseId: row.warehouseId,
        quantityPlanned: row.quantityPlanned,
        notes: row.notes,
      })
      nextLines.push(updated)
    } else {
      nextLines.push(row)
    }
  }

  return nextLines
}

export async function fetchTaskMaterialLinesForTasksClient(
  taskIds: string[]
): Promise<Record<string, TaskMaterialLineView[]>> {
  if (taskIds.length === 0) return {}

  const response = await fetch("/api/tasks/material-lines/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskIds }),
  })

  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }

  const body = (await response.json()) as {
    success: boolean
    linesByTaskId: Record<string, TaskMaterialLineView[]>
  }
  return body.linesByTaskId ?? {}
}
