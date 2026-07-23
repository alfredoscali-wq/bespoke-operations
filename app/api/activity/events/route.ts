import { NextResponse } from "next/server"

import { isActivityAction, isActivityResult } from "@/lib/activity/catalog"
import {
  getClientActivityRejectionMessage,
  isClientWritableActivityAction,
} from "@/lib/activity/client-policy"
import { recordActivityEvent } from "@/lib/activity/activity-service"
import { queryActivityEvents } from "@/lib/activity/activity-viewer.server"
import { parseActivityViewerSearchParams } from "@/lib/activity/activity-viewer-query"
import {
  ACTIVITY_ACTOR_TYPES,
  ACTIVITY_ORIGINS,
  type ActivityClientMetadata,
  type ActivityEntityType,
  type ActivityModule,
  type ActivityOrigin,
  type ActivityResult,
  type ActivitySeverity,
  type RecordActivityEventInput,
} from "@/lib/activity/types"
import { requireAdministratorSession } from "@/lib/auth/require-administrator"
import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import { resolveTenantCompanyId } from "@/lib/operations/tenant-scope"
import { createAdminClient } from "@/lib/supabase/admin"

type RecordActivityEventBody = {
  action: string
  module: ActivityModule
  entityType: ActivityEntityType
  entityId?: string | null
  detail?: string | null
  metadata?: Record<string, unknown>
  origin?: ActivityOrigin
  correlationId?: string | null
  severity?: ActivitySeverity
  result?: string | null
  sessionId?: string | null
  durationMs?: number | null
  geo?: {
    latitude: number
    longitude: number
    accuracyM?: number | null
  } | null
  client?: Record<string, unknown> | null
}

function parseOrigin(value: unknown): ActivityOrigin {
  if (
    value === ACTIVITY_ORIGINS.WEB ||
    value === ACTIVITY_ORIGINS.MOBILE ||
    value === ACTIVITY_ORIGINS.API ||
    value === ACTIVITY_ORIGINS.CRON ||
    value === ACTIVITY_ORIGINS.SYSTEM
  ) {
    return value
  }

  return ACTIVITY_ORIGINS.WEB
}

export async function GET(request: Request) {
  const auth = await requireAdministratorSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  const { searchParams } = new URL(request.url)
  const filters = parseActivityViewerSearchParams(searchParams)

  try {
    const admin = createAdminClient()
    const result = await queryActivityEvents(admin, {
      companyId: resolveTenantCompanyId(auth.sessionUser),
      from: filters.from,
      to: filters.to,
      employeeId: filters.employeeId,
      userSearch: filters.userSearch,
      area: filters.area,
      module: filters.module,
      action: filters.action,
      origin: filters.origin,
      offset: filters.offset,
      limit: filters.limit,
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo cargar Activity Engine."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireWritablePlatformSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  let body: RecordActivityEventBody

  try {
    body = (await request.json()) as RecordActivityEventBody
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  if (!body.action || !isActivityAction(body.action)) {
    return NextResponse.json(
      { success: false, message: "Acción de Activity Engine inválida." },
      { status: 400 }
    )
  }

  if (!isClientWritableActivityAction(body.action)) {
    return NextResponse.json(
      {
        success: false,
        message: getClientActivityRejectionMessage(body.action),
      },
      { status: 403 }
    )
  }

  const companyId = resolveTenantCompanyId(auth.sessionUser)
  const employeeId = auth.sessionUser.employeeId

  if (body.result != null && body.result !== "" && !isActivityResult(body.result)) {
    return NextResponse.json(
      { success: false, message: "Resultado de Activity Engine inválido." },
      { status: 400 }
    )
  }

  const geo =
    body.geo &&
    typeof body.geo.latitude === "number" &&
    typeof body.geo.longitude === "number"
      ? {
          latitude: body.geo.latitude,
          longitude: body.geo.longitude,
          accuracyM: body.geo.accuracyM ?? null,
        }
      : null

  const input: RecordActivityEventInput = {
    companyId,
    employeeId,
    actorType: employeeId
      ? ACTIVITY_ACTOR_TYPES.EMPLOYEE
      : ACTIVITY_ACTOR_TYPES.USER,
    module: body.module,
    entityType: body.entityType,
    entityId: body.entityId ?? null,
    action: body.action,
    detail: body.detail ?? null,
    metadata: body.metadata,
    origin: parseOrigin(body.origin),
    correlationId: body.correlationId ?? null,
    severity: body.severity,
    result:
      body.result == null || body.result === ""
        ? null
        : (body.result as ActivityResult),
    sessionId: body.sessionId ?? null,
    durationMs: body.durationMs ?? null,
    geo,
    client: (body.client as ActivityClientMetadata | null | undefined) ?? null,
  }

  try {
    const entry = await recordActivityEvent(input)
    return NextResponse.json({ success: true, entry })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo registrar el evento de Activity Engine."

    console.error("[Activity Engine] POST /api/activity/events failed", message)

    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
