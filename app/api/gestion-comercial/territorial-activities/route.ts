import { NextResponse } from "next/server"

import {
  requireGestionComercialMutationContext,
  requireGestionComercialReadContext,
} from "@/lib/commercial/route-context"
import { createClient } from "@/lib/supabase/server"
import {
  createCommercialTerritorialActivity,
  listCommercialTerritorialActivities,
} from "@/lib/supabase/commercial-territorial-activities.queries"
import type { CreateCommercialTerritorialActivityInput } from "@/lib/types/commercial-territorial-activity"

export async function GET() {
  const auth = await requireGestionComercialReadContext()
  if (!auth.ok) return auth.response

  const client = await createClient()
  const result = await listCommercialTerritorialActivities(
    client,
    auth.companyId
  )
  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, activities: result.data })
}

export async function POST(request: Request) {
  const auth = await requireGestionComercialMutationContext()
  if (!auth.ok) return auth.response

  let payload: CreateCommercialTerritorialActivityInput
  try {
    payload = (await request.json()) as CreateCommercialTerritorialActivityInput
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const client = await createClient()
  const result = await createCommercialTerritorialActivity(
    client,
    auth.companyId,
    payload,
    { employeeId: auth.employeeId }
  )

  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: result.error.code === "VALIDATION" ? 400 : 500 }
    )
  }

  return NextResponse.json(
    { success: true, activity: result.data },
    { status: 201 }
  )
}
