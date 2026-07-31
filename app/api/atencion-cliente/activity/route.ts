import { NextResponse } from "next/server"

import { ACTIVITY_ACTIONS, isActivityAction } from "@/lib/activity-engine/activity-actions"
import {
  isActivityCategory,
  isActivityImpact,
  isActivityOrigin,
  type ActivityCategory,
  type ActivityImpact,
  type ActivityOrigin,
} from "@/lib/activity-engine/activity-types"
import {
  recordAttentionCreatedActivity,
  recordAttentionResolvedActivity,
} from "@/lib/activity/domain/attention-activity"
import { activityActorFromSession } from "@/lib/activity/resolve-activity-actor"
import { requireAtencionClienteMutationContext } from "@/lib/customer-atenciones/consultation-management-route"
import { registerCustomerActivity } from "@/lib/customer-atenciones/register-customer-activity"

type Body = {
  entityId?: string
  action?: string
  category?: string
  impact?: string
  origin?: string
  title?: string | null
  description?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Thin bridge for browser-originated Customer Service events.
 * Server always persists via registerCustomerActivity → activity.record().
 */
export async function POST(request: Request) {
  const auth = await requireAtencionClienteMutationContext()
  if (!auth.ok) {
    return auth.response
  }

  const body = (await request.json().catch(() => null)) as Body | null
  const entityId = typeof body?.entityId === "string" ? body.entityId.trim() : ""
  const action = typeof body?.action === "string" ? body.action.trim() : ""

  if (!entityId || !action || !isActivityAction(action)) {
    return NextResponse.json(
      { success: false, message: "entityId y action válidos son obligatorios." },
      { status: 400 }
    )
  }

  const category =
    body?.category == null
      ? undefined
      : isActivityCategory(body.category)
        ? (body.category as ActivityCategory)
        : null
  if (category === null) {
    return NextResponse.json(
      { success: false, message: "category inválida." },
      { status: 400 }
    )
  }

  const impact =
    body?.impact == null
      ? undefined
      : isActivityImpact(body.impact)
        ? (body.impact as ActivityImpact)
        : null
  if (impact === null) {
    return NextResponse.json(
      { success: false, message: "impact inválido." },
      { status: 400 }
    )
  }

  const origin =
    body?.origin == null
      ? undefined
      : isActivityOrigin(body.origin)
        ? (body.origin as ActivityOrigin)
        : null
  if (origin === null) {
    return NextResponse.json(
      { success: false, message: "origin inválido." },
      { status: 400 }
    )
  }

  const result = await registerCustomerActivity({
    companyId: auth.companyId,
    entityId,
    employeeId: auth.employeeId,
    action,
    category,
    impact,
    origin,
    title: body?.title,
    description: body?.description,
    metadata: body?.metadata ?? {},
  })

  if (!result.ok) {
    return NextResponse.json(
      { success: false, message: result.error.message, code: result.error.code },
      { status: result.error.code === "VALIDATION_ERROR" ? 400 : 500 }
    )
  }

  const actor = activityActorFromSession(auth.sessionUser)
  if (actor) {
    if (action === ACTIVITY_ACTIONS.CASE_CREATED) {
      const status =
        typeof body?.metadata?.estado_inicial === "string"
          ? body.metadata.estado_inicial
          : null
      void recordAttentionCreatedActivity({
        actor,
        attentionId: entityId,
        status,
      })
    } else if (action === ACTIVITY_ACTIONS.CASE_CLOSED) {
      void recordAttentionResolvedActivity({
        actor,
        attentionId: entityId,
        oldStatus: null,
      })
    }
  }

  return NextResponse.json({ success: true, id: result.data.id })
}
