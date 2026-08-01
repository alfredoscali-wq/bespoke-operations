import type { CrewsReadModel } from "@/lib/analysis/crews/types"
import type { CrewsPeriodPreset } from "@/lib/analysis/crews/period"

export type CrewsQueryResult = {
  model: CrewsReadModel
}

type CrewsFetchResult =
  | { success: true; data: CrewsQueryResult }
  | { success: false; message: string }

export async function fetchCrewsScreen(input: {
  preset: CrewsPeriodPreset
  dateFrom: string
  dateTo: string
}): Promise<CrewsFetchResult> {
  const params = new URLSearchParams({
    preset: input.preset,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  })

  const response = await fetch(`/api/activity/cuadrillas?${params.toString()}`)
  const payload = (await response.json()) as {
    success?: boolean
    message?: string
    model?: CrewsReadModel
  }

  if (!response.ok || !payload.success || !payload.model) {
    return {
      success: false,
      message: payload.message ?? "No se pudo cargar Cuadrillas.",
    }
  }

  return { success: true, data: { model: payload.model } }
}
