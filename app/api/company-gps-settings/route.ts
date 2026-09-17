import { NextResponse } from "next/server"

import { jsonFromSessionAuthFailure } from "@/lib/auth/require-password-compliant-session"
import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import { getSessionUser } from "@/lib/auth/session"
import {
  canManageCompanyGpsSettings,
  canReadCompanyGpsSettings,
} from "@/lib/company-gps-settings/access"
import { parseCompanyGpsSettingsPut } from "@/lib/company-gps-settings/validate"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  fetchCompanyGpsSettings,
  upsertCompanyGpsSettings,
} from "@/lib/supabase/company-gps-settings.queries"

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json(
      { success: false, message: "Debe iniciar sesión." },
      { status: 401 }
    )
  }

  if (!canReadCompanyGpsSettings(sessionUser)) {
    return NextResponse.json(
      { success: false, message: "Empresa no resuelta para la sesión." },
      { status: 400 }
    )
  }

  const companyId = sessionUser.companyId!.trim()
  const client = await createClient()
  const settings = await fetchCompanyGpsSettings(client, companyId)

  return NextResponse.json({
    success: true,
    settings,
  })
}

export async function PUT(request: Request) {
  const auth = await requireWritablePlatformSession()
  if (!auth.ok) {
    return jsonFromSessionAuthFailure(auth)
  }

  if (!canManageCompanyGpsSettings(auth.sessionUser)) {
    return NextResponse.json(
      {
        success: false,
        message: "Solo un administrador puede modificar la geolocalización.",
      },
      { status: 403 }
    )
  }

  const companyId = auth.sessionUser.companyId?.trim() ?? ""
  if (!companyId) {
    return NextResponse.json(
      { success: false, message: "Empresa no resuelta para la sesión." },
      { status: 400 }
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

  const admin = createAdminClient()
  const current = await fetchCompanyGpsSettings(admin, companyId)
  const parsed = parseCompanyGpsSettingsPut(
    body && typeof body === "object" ? (body as Record<string, unknown>) : {},
    current
  )
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, message: parsed.message },
      { status: 400 }
    )
  }

  const result = await upsertCompanyGpsSettings(admin, companyId, parsed.settings)
  if (result.error || !result.data) {
    return NextResponse.json(
      {
        success: false,
        message: result.error ?? "No se pudo guardar la configuración GPS.",
      },
      { status: 400 }
    )
  }

  return NextResponse.json({
    success: true,
    settings: result.data,
  })
}
