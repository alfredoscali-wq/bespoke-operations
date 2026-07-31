import type { ExecutiveBrief } from "@/lib/executive"

export type SituationRoomQueryResult = {
  date: string
  brief: ExecutiveBrief
}

type SituationRoomFetchResult =
  | { success: true; data: SituationRoomQueryResult }
  | { success: false; message: string }

export async function fetchSituationRoom(
  date: string
): Promise<SituationRoomFetchResult> {
  const params = new URLSearchParams({ date })
  const response = await fetch(
    `/api/activity/operations-intelligence?${params.toString()}`
  )
  const payload = (await response.json()) as SituationRoomQueryResult & {
    success?: boolean
    message?: string
    brief?: ExecutiveBrief
    date?: string
  }

  if (!response.ok || !payload.success || !payload.brief) {
    return {
      success: false,
      message:
        payload.message ?? "No se pudo cargar la Sala de Situación.",
    }
  }

  return {
    success: true,
    data: {
      date: payload.date ?? date,
      brief: payload.brief,
    },
  }
}
