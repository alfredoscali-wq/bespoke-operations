/**
 * Browser client for OPS 2.3A/C route recalculation.
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

export type PlanningBaseOverridePayload = {
  name: string
  latitude: number
  longitude: number
}

export async function recalculatePlanningRoutesForCrew(input: {
  crewId: string
  taskIds: string[]
  /** Day-level base override (session). Null clears to crew permanent base. */
  baseOverride?: PlanningBaseOverridePayload | null
}): Promise<RecalculatePlanningRoutesResult> {
  try {
    const response = await fetch("/api/planificacion/routes/recalculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        crewId: input.crewId,
        taskIds: input.taskIds,
        baseOverride: input.baseOverride ?? null,
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
