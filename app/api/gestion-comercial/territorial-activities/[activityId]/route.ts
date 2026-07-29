import { NextResponse } from "next/server"

import {
  requireGestionComercialMutationContext,
  requireGestionComercialReadContext,
} from "@/lib/commercial/route-context"
import { createClient } from "@/lib/supabase/server"
import {
  getCommercialTerritorialActivityById,
  softDeleteCommercialTerritorialActivity,
} from "@/lib/supabase/commercial-territorial-activities.queries"

type RouteContext = {
  params: Promise<{ activityId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireGestionComercialReadContext()
  if (!auth.ok) return auth.response

  const { activityId } = await context.params
  const client = await createClient()
  const result = await getCommercialTerritorialActivityById(
    client,
    auth.companyId,
    activityId
  )

  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: result.error.code === "NOT_FOUND" ? 404 : 500 }
    )
  }

  return NextResponse.json({ success: true, activity: result.data })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireGestionComercialMutationContext()
  if (!auth.ok) return auth.response

  const { activityId } = await context.params
  const client = await createClient()
  const result = await softDeleteCommercialTerritorialActivity(
    client,
    auth.companyId,
    activityId,
    { employeeId: auth.employeeId }
  )

  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
