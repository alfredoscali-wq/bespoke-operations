import { NextResponse } from "next/server"

import {
  NETWORK_RETENTION_BATCH_LIMIT,
  isNetworkRetentionCronAuthorized,
  runNetworkJobRetention,
} from "@/lib/network/jobs/retention"
import { getCronSecret } from "@/lib/reports/automatic/config"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

type RetentionRpcRow = {
  retention_class?: string
  jobs_deleted?: number
  events_deleted?: number
  applied?: boolean
}

type RetentionRpc = {
  rpc: (
    fn: "network_purge_expired_jobs",
    args: {
      p_captured_at: string
      p_class: string
      p_limit: number
      p_dry_run: boolean
    }
  ) => Promise<{ data: RetentionRpcRow[] | null; error: { message: string } | null }>
}

export async function GET(request: Request) {
  if (!isNetworkRetentionCronAuthorized(
    request.headers.get("authorization"),
    getCronSecret()
  )) {
    return NextResponse.json(
      { success: false, message: "No autorizado." },
      { status: 401 }
    )
  }

  const capturedAt = new Date().toISOString()
  const admin = createAdminClient() as unknown as RetentionRpc
  const report = await runNetworkJobRetention({
    capturedAt,
    purge: async (retentionClass, captured) => {
      const { data, error } = await admin.rpc("network_purge_expired_jobs", {
        p_captured_at: captured,
        p_class: retentionClass,
        p_limit: NETWORK_RETENTION_BATCH_LIMIT,
        p_dry_run: false,
      })
      if (error) throw new Error(error.message)
      const row = data?.[0]
      if (!row || row.applied !== true) {
        throw new Error("La retención no confirmó el lote.")
      }
      return {
        jobsDeleted: row.jobs_deleted ?? 0,
        eventsDeleted: row.events_deleted ?? 0,
      }
    },
  })

  return NextResponse.json(
    {
      success: report.ok,
      completed: report.completed,
      stoppedReason: report.stoppedReason,
      capturedAt: report.capturedAt,
      results: report.results,
      ...(report.message ? { message: report.message } : {}),
    },
    { status: report.ok ? 200 : 500 }
  )
}
