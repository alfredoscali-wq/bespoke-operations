/**
 * Browser client for OPS 2.3A route recalculation.
 * Never calls OpenRouteService from the browser.
 */

export type RecalculatePlanningRoutesResult =
  | {
      success: true
      recalculatedCount: number
      skippedManualCount: number
      failedCount: number
      updatedTaskIds: string[]
      warning?: string
    }
  | { success: false; message: string }

export async function recalculatePlanningRoutesForCrew(input: {
  crewId: string
  taskIds: string[]
}): Promise<RecalculatePlanningRoutesResult> {
  try {
    const response = await fetch("/api/planificacion/routes/recalculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        crewId: input.crewId,
        taskIds: input.taskIds,
      }),
    })

    const payload = (await response.json().catch(() => null)) as
      | RecalculatePlanningRoutesResult
      | null

    if (!response.ok || !payload) {
      return {
        success: false,
        message:
          payload && "message" in payload && payload.success === false
            ? payload.message
            : "No se pudo recalcular los traslados.",
      }
    }

    return payload
  } catch {
    return {
      success: false,
      message: "No se pudo recalcular los traslados.",
    }
  }
}
