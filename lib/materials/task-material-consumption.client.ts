import type { ConsumptionLineInput } from "@/lib/materials/task-material-consumption"
import type { ConfirmMaterialConsumptionResult } from "@/lib/supabase/task-material-consumption.queries"
import type { TaskMaterialLineView } from "@/lib/types/materials"

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

export async function fetchReservedTaskMaterialLinesClient(
  taskId: string
): Promise<TaskMaterialLineView[]> {
  const response = await fetch(`/api/tasks/${taskId}/material-consumption`, {
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

export async function fetchTaskMaterialLinesDetailClient(
  taskId: string
): Promise<TaskMaterialLineView[]> {
  const response = await fetch(
    `/api/tasks/${taskId}/material-lines?scope=detail`,
    { cache: "no-store" }
  )
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }
  const body = (await response.json()) as {
    success: boolean
    lines: TaskMaterialLineView[]
  }
  return body.lines ?? []
}

export async function confirmTaskMaterialConsumptionClient(input: {
  taskId: string
  useAll: boolean
  lines?: ConsumptionLineInput[]
}): Promise<ConfirmMaterialConsumptionResult> {
  const response = await fetch(
    `/api/tasks/${input.taskId}/material-consumption`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        useAll: input.useAll,
        lines: input.lines,
      }),
    }
  )
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }
  const body = (await response.json()) as {
    success: boolean
    result: ConfirmMaterialConsumptionResult
  }
  return body.result
}
