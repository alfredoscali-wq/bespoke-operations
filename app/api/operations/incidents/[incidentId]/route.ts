import { NextResponse } from "next/server"

import { getSessionUser } from "@/lib/auth/session"
import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import {
  getOperationsIncidentById,
  updateOperationsIncidentStatus,
} from "@/lib/operations/incidents/task-incident-operations.server"
import type { UpdateIncidentStatusRequest } from "@/lib/types/task-incidents"

type RouteContext = {
  params: Promise<{ incidentId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const sessionUser = await getSessionUser()

  if (!sessionUser) {
    return NextResponse.json(
      { success: false, message: "Debe iniciar sesión para realizar esta acción." },
      { status: 401 }
    )
  }

  const { incidentId } = await context.params
  const result = await getOperationsIncidentById(sessionUser, incidentId.trim())

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

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireWritablePlatformSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  const { incidentId } = await context.params

  let body: UpdateIncidentStatusRequest

  try {
    body = (await request.json()) as UpdateIncidentStatusRequest
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const result = await updateOperationsIncidentStatus(
    auth.sessionUser,
    incidentId.trim(),
    body
  )

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
