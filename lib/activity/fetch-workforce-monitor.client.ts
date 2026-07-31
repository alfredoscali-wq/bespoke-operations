import type { WorkforceMonitorRow } from "@/lib/activity/workforce-monitor"

export type WorkforceMonitorQueryResult = {
  date: string
  rows: WorkforceMonitorRow[]
  totalEvents: number
}

type WorkforceMonitorFetchResult =
  | { success: true; data: WorkforceMonitorQueryResult }
  | { success: false; message: string }

export async function fetchWorkforceMonitor(
  date: string
): Promise<WorkforceMonitorFetchResult> {
  const params = new URLSearchParams({ date })
  const response = await fetch(
    `/api/activity/workforce-monitor?${params.toString()}`
  )
  const payload = (await response.json()) as WorkforceMonitorQueryResult & {
    success?: boolean
    message?: string
  }

  if (!response.ok || !payload.success) {
    return {
      success: false,
      message: payload.message ?? "No se pudo cargar el Workforce Monitor.",
    }
  }

  return {
    success: true,
    data: {
      date: payload.date,
      rows: payload.rows ?? [],
      totalEvents: payload.totalEvents ?? 0,
    },
  }
}
