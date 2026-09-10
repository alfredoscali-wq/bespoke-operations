import { NextResponse } from "next/server"

import { getSessionUser } from "@/lib/auth/session"
import {
  denyIfPasswordChangeRequired,
  passwordChangeRequiredResponse,
} from "@/lib/auth/require-password-compliant-session"
import {
  listOperationsIncidents,
  parseOperationsIncidentListFilters,
} from "@/lib/operations/incidents/task-incident-operations.server"

export async function GET(request: Request) {
  const sessionUser = await getSessionUser()

  if (!sessionUser) {
    return NextResponse.json(
      { success: false, message: "Debe iniciar sesión para realizar esta acción." },
      { status: 401 }
    )
  }

  const passwordDenial = denyIfPasswordChangeRequired(sessionUser)
  if (passwordDenial) {
    return passwordChangeRequiredResponse()
  }

  const { searchParams } = new URL(request.url)
  const filters = parseOperationsIncidentListFilters(searchParams)
  const result = await listOperationsIncidents(sessionUser, filters)

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        message: result.message,
        code: result.code,
      },
      { status: result.status }
    )
  }

  return NextResponse.json({
    success: true,
    data: result.data,
  })
}

export async function POST() {
  return NextResponse.json(
    { success: false, message: "Método no permitido." },
    { status: 405 }
  )
}
