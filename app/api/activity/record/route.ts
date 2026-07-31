import { NextResponse } from "next/server"

import {
  ACTIVITY_EVENT_ACTIONS,
  ACTIVITY_EVENT_TITLES,
  type ActivityEventAction,
} from "@/lib/activity/actions"
import { recordActivity } from "@/lib/activity/activity-service"
import { activityActorFromSession } from "@/lib/activity/resolve-activity-actor"
import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"

const ALLOWED_ACTIONS = new Set<string>(Object.values(ACTIVITY_EVENT_ACTIONS))

type RecordActivityBody = {
  module?: string
  entityType?: string
  entityId?: string | null
  action?: string
  title?: string
  description?: string | null
  metadata?: Record<string, unknown>
}

function isActivityEventAction(value: string): value is ActivityEventAction {
  return ALLOWED_ACTIONS.has(value)
}

export async function POST(request: Request) {
  const auth = await requireWritablePlatformSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  const actor = activityActorFromSession(auth.sessionUser)
  if (!actor) {
    return NextResponse.json(
      { success: false, message: "No se pudo resolver el tenant del usuario." },
      { status: 403 }
    )
  }

  let body: RecordActivityBody
  try {
    body = (await request.json()) as RecordActivityBody
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const moduleName = body.module?.trim() ?? ""
  const entityType = body.entityType?.trim() ?? ""
  const action = body.action?.trim() ?? ""
  const title = body.title?.trim() ?? ""

  if (!moduleName || !entityType || !action) {
    return NextResponse.json(
      {
        success: false,
        message: "module, entityType y action son obligatorios.",
      },
      { status: 400 }
    )
  }

  if (!isActivityEventAction(action)) {
    return NextResponse.json(
      { success: false, message: "Acción de Activity Engine inválida." },
      { status: 400 }
    )
  }

  // Best-effort: never fail the caller because Activity persistence failed.
  const result = await recordActivity({
    companyId: actor.companyId,
    employeeId: actor.employeeId,
    appUserId: actor.appUserId,
    module: moduleName,
    entityType,
    entityId: body.entityId ?? null,
    action,
    title: title || ACTIVITY_EVENT_TITLES[action],
    description: body.description ?? null,
    metadata:
      body.metadata && typeof body.metadata === "object" ? body.metadata : {},
  })

  return NextResponse.json({
    success: true,
    id: result?.id ?? null,
  })
}
