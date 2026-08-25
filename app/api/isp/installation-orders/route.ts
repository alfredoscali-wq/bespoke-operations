import { NextResponse } from "next/server"

import { listCompletedNewInstallationTasks } from "@/lib/isp/queries"
import { requireIspReadContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const auth = await requireIspReadContext()
  if (!auth.ok) return auth.response

  try {
    const client = await createClient()
    const orders = await listCompletedNewInstallationTasks(
      client,
      auth.companyId
    )
    return NextResponse.json({ success: true, orders })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las OT de instalación.",
      },
      { status: 500 }
    )
  }
}
