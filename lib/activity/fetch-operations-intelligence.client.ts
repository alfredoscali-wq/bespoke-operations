import type {
  OperationsIntelligenceAreaCard,
  OperationsIntelligenceSummary,
} from "@/lib/activity/operations-intelligence"

export type OperationsIntelligenceQueryResult = {
  date: string
  summary: OperationsIntelligenceSummary
  areas: OperationsIntelligenceAreaCard[]
}

type OperationsIntelligenceFetchResult =
  | { success: true; data: OperationsIntelligenceQueryResult }
  | { success: false; message: string }

export async function fetchOperationsIntelligence(
  date: string
): Promise<OperationsIntelligenceFetchResult> {
  const params = new URLSearchParams({ date })
  const response = await fetch(
    `/api/activity/operations-intelligence?${params.toString()}`
  )
  const payload = (await response.json()) as OperationsIntelligenceQueryResult & {
    success?: boolean
    message?: string
  }

  if (!response.ok || !payload.success) {
    return {
      success: false,
      message:
        payload.message ?? "No se pudo cargar Operations Intelligence.",
    }
  }

  return {
    success: true,
    data: {
      date: payload.date,
      summary: payload.summary,
      areas: payload.areas ?? [],
    },
  }
}
