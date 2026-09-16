import { NextResponse } from "next/server"

import { jsonFromSessionAuthFailure } from "@/lib/auth/require-password-compliant-session"
import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import { getSessionUser } from "@/lib/auth/session"
import {
  canManageCompanyBranding,
  canReadCompanyBranding,
} from "@/lib/company-branding/access"
import { parseCompanyBrandingPatch } from "@/lib/company-branding/validate"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  fetchCompanyBranding,
  upsertCompanyBranding,
} from "@/lib/supabase/company-branding.queries"

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json(
      { success: false, message: "Debe iniciar sesión." },
      { status: 401 }
    )
  }

  if (!canReadCompanyBranding(sessionUser)) {
    return NextResponse.json(
      { success: false, message: "Empresa no resuelta para la sesión." },
      { status: 400 }
    )
  }

  const companyId = sessionUser.companyId!.trim()
  const client = await createClient()
  const branding = await fetchCompanyBranding(client, companyId)

  return NextResponse.json({
    success: true,
    branding,
  })
}

export async function PUT(request: Request) {
  const auth = await requireWritablePlatformSession()
  if (!auth.ok) {
    return jsonFromSessionAuthFailure(auth)
  }

  if (!canManageCompanyBranding(auth.sessionUser)) {
    return NextResponse.json(
      {
        success: false,
        message: "Solo un administrador puede modificar la identidad de empresa.",
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

  const parsed = parseCompanyBrandingPatch(
    body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  )
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, message: parsed.message },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const result = await upsertCompanyBranding(admin, companyId, parsed.patch)
  if (result.error || !result.data) {
    return NextResponse.json(
      {
        success: false,
        message: result.error ?? "No se pudo guardar la identidad de empresa.",
      },
      { status: 400 }
    )
  }

  return NextResponse.json({
    success: true,
    branding: result.data,
  })
}
