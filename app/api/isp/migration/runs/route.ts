import { NextResponse } from "next/server"

import {
  getIspOnboardingCutoff,
  listIspMigrationRuns,
} from "@/lib/isp/migration/queries"
import { requireIspMigrationReadContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const auth = await requireIspMigrationReadContext()
  if (!auth.ok) return auth.response

  try {
    const client = await createClient()
    const [runs, cutoffAt] = await Promise.all([
      listIspMigrationRuns(client, auth.companyId),
      getIspOnboardingCutoff(client, auth.companyId),
    ])
    return NextResponse.json({ success: true, runs, cutoffAt })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el historial de migraciones.",
      },
      { status: 500 }
    )
  }
}
