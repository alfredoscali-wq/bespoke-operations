import { NextResponse } from "next/server"

import {
  extractRequestAuditContext,
} from "@/lib/audit/request-context"
import { isAuditAction } from "@/lib/audit/audit-catalog"
import {
  getClientAuditRejectionMessage,
  isClientWritableAuditAction,
} from "@/lib/audit/client-policy"
import { queryAuditLogs, writeAuditLog } from "@/lib/audit/audit-service"
import type {
  AuditEntityType,
  AuditModule,
  AuditSeverity,
  WriteAuditLogInput,
} from "@/lib/audit/types"
import { getSessionUser } from "@/lib/auth/session"
import { requireAdministratorSession } from "@/lib/auth/require-administrator"
import { createAdminClient } from "@/lib/supabase/admin"

type RecordAuditEventBody = Omit<
  WriteAuditLogInput,
  "performedBy" | "ipAddress" | "userAgent"
>

function parseAuditModule(value: string | null): AuditModule | undefined {
  if (!value) return undefined
  return value as AuditModule
}

function parseAuditSeverity(value: string | null): AuditSeverity | undefined {
  if (!value) return undefined
  return value as AuditSeverity
}

function parseAuditEntityType(
  value: string | null
): AuditEntityType | undefined {
  if (!value) return undefined
  return value as AuditEntityType
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

  try {
    const admin = createAdminClient()
    const result = await queryAuditLogs(admin, {
      module: parseAuditModule(searchParams.get("module")),
      action: searchParams.get("action") ?? undefined,
      entityType: parseAuditEntityType(searchParams.get("entityType")),
      entityId: searchParams.get("entityId") ?? undefined,
      severity: parseAuditSeverity(searchParams.get("severity")),
      performedByUserId: searchParams.get("performedByUserId") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      page: Number.parseInt(searchParams.get("page") ?? "1", 10),
      limit: Number.parseInt(searchParams.get("limit") ?? "50", 10),
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo cargar el Historial del Sistema."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()

  if (!sessionUser) {
    return NextResponse.json(
      { success: false, message: "Debe iniciar sesión para registrar eventos." },
      { status: 401 }
    )
  }

  let body: RecordAuditEventBody

  try {
    body = (await request.json()) as RecordAuditEventBody
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  if (!body.action || !isAuditAction(body.action)) {
    return NextResponse.json(
      { success: false, message: "Acción de auditoría inválida." },
      { status: 400 }
    )
  }

  if (!isClientWritableAuditAction(body.action)) {
    return NextResponse.json(
      {
        success: false,
        message: getClientAuditRejectionMessage(body.action),
      },
      { status: 403 }
    )
  }

  const requestContext = extractRequestAuditContext(request)

  try {
    const admin = createAdminClient()
    const { severity: _severity, ...eventInput } = body
    const entry = await writeAuditLog(admin, {
      ...eventInput,
      performedBy: { kind: "user", sessionUser },
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
    })

    return NextResponse.json({ success: true, entry })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo registrar el evento en el Historial del Sistema."

    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
