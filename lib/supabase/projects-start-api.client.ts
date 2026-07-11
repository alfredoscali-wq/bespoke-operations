import type { StartProjectDispatchResult } from "@/lib/projects/project-start-dispatch"

export type StartProjectDispatchApiResult =
  | { success: true; data: StartProjectDispatchResult }
  | { success: false; message: string }

export async function startProjectThroughApi(
  projectId: string
): Promise<StartProjectDispatchApiResult> {
  const response = await fetch(`/api/projects/${projectId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })

  let body: {
    success?: boolean
    message?: string
    projectId?: string
    previousStatus?: "planned"
    nextStatus?: "active"
    dispatchedCount?: number
    dispatchedTaskIds?: string[]
  } = {}

  try {
    body = (await response.json()) as typeof body
  } catch {
    body = {}
  }

  if (!response.ok || !body.success) {
    return {
      success: false,
      message:
        body.message ??
        "No fue posible iniciar la obra. Intente nuevamente.",
    }
  }

  if (
    !body.projectId ||
    typeof body.dispatchedCount !== "number" ||
    !Array.isArray(body.dispatchedTaskIds)
  ) {
    return {
      success: false,
      message: "Respuesta inválida al iniciar la obra.",
    }
  }

  return {
    success: true,
    data: {
      projectId: body.projectId,
      previousStatus: "planned",
      nextStatus: "active",
      dispatchedCount: body.dispatchedCount,
      dispatchedTaskIds: body.dispatchedTaskIds,
    },
  }
}
