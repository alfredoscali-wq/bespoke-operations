import { NextResponse } from "next/server"

import {
  recordMobileDeviceActivatedAudit,
  recordMobileDeviceBlockedAudit,
} from "@/lib/audit/devices-audit.server"
import { extractRequestAuditContext } from "@/lib/audit/request-context"
import { requireAdministratorSession } from "@/lib/auth/require-administrator"
import {
  listMobileDevicesByCompany,
  updateMobileDeviceStatus,
} from "@/lib/mobile-devices/mobile-devices.queries"
import type { MobileDeviceStatus } from "@/lib/mobile-devices/types"
import { resolveTenantCompanyId } from "@/lib/operations/tenant-scope"
import { createAdminClient } from "@/lib/supabase/admin"

function parseStatus(value: unknown): MobileDeviceStatus | null {
  if (value === "ACTIVE" || value === "BLOCKED") {
    return value
  }
  return null
}

export async function GET() {
  const auth = await requireAdministratorSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  try {
    const admin = createAdminClient()
    const companyId = resolveTenantCompanyId(auth.sessionUser)
    const devices = await listMobileDevicesByCompany(admin, companyId)

    return NextResponse.json({
      success: true,
      devices,
    })
  } catch (error) {
    console.error("[Admin Mobile Devices]", error)
    return NextResponse.json(
      { success: false, message: "No se pudieron cargar los dispositivos." },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdministratorSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const record = body as Record<string, unknown>
  const deviceRecordId =
    typeof record.id === "string" ? record.id.trim() : ""
  const status = parseStatus(record.status)

  if (!deviceRecordId || !status) {
    return NextResponse.json(
      { success: false, message: "id y status (ACTIVE|BLOCKED) son obligatorios." },
      { status: 400 }
    )
  }

  try {
    const admin = createAdminClient()
    const companyId = resolveTenantCompanyId(auth.sessionUser)
    const device = await updateMobileDeviceStatus(
      admin,
      companyId,
      deviceRecordId,
      status
    )
    const requestContext = extractRequestAuditContext(request)

    try {
      if (status === "ACTIVE") {
        await recordMobileDeviceActivatedAudit(auth.sessionUser, device, requestContext)
      } else {
        await recordMobileDeviceBlockedAudit(auth.sessionUser, device, requestContext)
      }
    } catch {
      // Status update succeeded; audit failure must not block admin action.
    }

    return NextResponse.json({
      success: true,
      device,
    })
  } catch (error) {
    console.error("[Admin Mobile Devices]", error)
    return NextResponse.json(
      { success: false, message: "No se pudo actualizar el dispositivo." },
      { status: 500 }
    )
  }
}
