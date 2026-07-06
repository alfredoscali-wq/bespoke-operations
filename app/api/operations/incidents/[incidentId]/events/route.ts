import { NextResponse } from "next/server"

import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import { addOperationsIncidentEvent } from "@/lib/operations/incidents/task-incident-operations.server"
import type { AddIncidentEventRequest } from "@/lib/types/task-incidents"

type RouteContext = {
  params: Promise<{ incidentId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireWritablePlatformSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  const { incidentId } = await context.params

  let body: AddIncidentEventRequest

  try {
    body = (await request.json()) as AddIncidentEventRequest
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const result = await addOperationsIncidentEvent(
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

  return NextResponse.json(
    {
      success: true,
      data: result.data,
    },
    { status: 201 }
  )
}

export async function GET() {
  return NextResponse.json(
    { success: false, message: "Método no permitido." },
    { status: 405 }
  )
}
