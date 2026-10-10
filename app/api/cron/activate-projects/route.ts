import { NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { activateDuePlannedProjects } from "@/lib/supabase/projects.queries"
import { getCronSecret } from "@/lib/reports/automatic/config"
import { toLocalDateOnly } from "@/lib/dates/date-only"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isAuthorized(request: Request): boolean {
  const secret = getCronSecret()
  if (!secret) {
    return false
  }

  const headerSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const querySecret = new URL(request.url).searchParams.get("secret")

  return headerSecret === secret || querySecret === secret
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, message: "No autorizado." },
      { status: 401 }
    )
  }

  try {
    const admin = createAdminClient()
    const today = toLocalDateOnly()
    const { data: companies, error } = await admin
      .from("companies")
      .select("id")
      .is("deleted_at", null)

    if (error) {
      throw new Error(error.message)
    }

    let activated = 0
    for (const company of companies ?? []) {
      activated += await activateDuePlannedProjects(admin, {
        companyId: company.id,
        today,
      })
    }

    return NextResponse.json({
      success: true,
      activated,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudieron activar las obras por fecha de inicio."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return GET(request)
}
