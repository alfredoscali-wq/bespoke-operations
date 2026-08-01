import type { ExecutiveCenterReadModel } from "@/lib/analysis/executive-center/types"

export type ExecutiveCenterQueryResult = {
  date: string
  model: ExecutiveCenterReadModel
}

type ExecutiveCenterFetchResult =
  | { success: true; data: ExecutiveCenterQueryResult }
  | { success: false; message: string }

export async function fetchExecutiveCenter(
  date: string
): Promise<ExecutiveCenterFetchResult> {
  const params = new URLSearchParams({ date })
  const response = await fetch(
    `/api/activity/executive-center?${params.toString()}`
  )
  const payload = (await response.json()) as {
    success?: boolean
    message?: string
    date?: string
    model?: ExecutiveCenterReadModel
  }

  if (!response.ok || !payload.success || !payload.model) {
    return {
      success: false,
      message: payload.message ?? "No se pudo cargar el Centro Ejecutivo.",
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
