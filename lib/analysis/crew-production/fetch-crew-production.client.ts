import type { CrewProductionReadModel } from "@/lib/analysis/crew-production/types"

export type CrewProductionQueryResult = {
  date: string
  model: CrewProductionReadModel
}

type CrewProductionFetchResult =
  | { success: true; data: CrewProductionQueryResult }
  | { success: false; message: string }

export async function fetchCrewProduction(
  date: string
): Promise<CrewProductionFetchResult> {
  const params = new URLSearchParams({ date })
  const response = await fetch(
    `/api/activity/crew-production?${params.toString()}`
  )
  const payload = (await response.json()) as {
    success?: boolean
    message?: string
    date?: string
    model?: CrewProductionReadModel
  }

  if (!response.ok || !payload.success || !payload.model) {
    return {
      success: false,
      message:
        payload.message ?? "No se pudo cargar Producción de Cuadrillas.",
    }
  }

  return {
    success: true,
    data: {
      date: payload.date ?? date,
      model: payload.model,
    },
  }
}
