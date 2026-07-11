import type { FinalizeProjectResult } from "@/lib/projects/project-finalize"

export type FinalizeProjectApiResult =
  | { success: true; data: FinalizeProjectResult }
  | { success: false; message: string }

export async function finalizeProjectThroughApi(
  projectId: string
): Promise<FinalizeProjectApiResult> {
  const response = await fetch(`/api/projects/${projectId}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })

  let body: {
    success?: boolean
    message?: string
    projectId?: string
    previousStatus?: "active" | "paused"
    nextStatus?: "closed"
    openTaskCount?: number
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
        "No fue posible finalizar la obra. Intente nuevamente.",
    }
  }

  if (
    !body.projectId ||
    (body.previousStatus !== "active" && body.previousStatus !== "paused") ||
    body.nextStatus !== "closed"
  ) {
    return {
      success: false,
      message: "Respuesta inválida al finalizar la obra.",
    }
  }

  return {
    success: true,
    data: {
      projectId: body.projectId,
      previousStatus: body.previousStatus,
      nextStatus: body.nextStatus,
      openTaskCount:
        typeof body.openTaskCount === "number" ? body.openTaskCount : 0,
    },
  }
}
