import { NextResponse } from "next/server"

import { jsonFromSessionAuthFailure } from "@/lib/auth/require-password-compliant-session"
import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import { canManageCompanyBranding } from "@/lib/company-branding/access"
import {
  COMPANY_BRANDING_LOGO_BUCKET,
  COMPANY_BRANDING_LOGO_MAX_BYTES,
} from "@/lib/company-branding/constants"
import {
  isAllowedCompanyBrandingLogoFile,
  resolveCompanyBrandingLogoMimeType,
} from "@/lib/company-branding/validate"
import { createAdminClient } from "@/lib/supabase/admin"
import { upsertCompanyBranding } from "@/lib/supabase/company-branding.queries"

export async function POST(request: Request) {
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

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { success: false, message: "No se pudo leer el archivo." },
      { status: 400 }
    )
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, message: "Seleccione un logo." },
      { status: 400 }
    )
  }

  const mimeType = resolveCompanyBrandingLogoMimeType({
    mimeType: file.type,
    fileName: file.name,
  })

  if (
    !isAllowedCompanyBrandingLogoFile({
      mimeType,
      size: file.size,
      fileName: file.name,
    })
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "El logo debe ser JPG, PNG o WEBP de hasta 2 MB.",
      },
      { status: 400 }
    )
  }

  const extension =
    mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg"
  const path = `${companyId}/logo.${extension}`

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (bytes.byteLength > COMPANY_BRANDING_LOGO_MAX_BYTES) {
      return NextResponse.json(
        { success: false, message: "El logo supera el tamaño máximo." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const { error } = await admin.storage
      .from(COMPANY_BRANDING_LOGO_BUCKET)
      .upload(path, bytes, {
        contentType: mimeType,
        upsert: true,
      })
    if (error) {
      throw error
    }

    const { data } = admin.storage
      .from(COMPANY_BRANDING_LOGO_BUCKET)
      .getPublicUrl(path)
    const cacheBusted = `${data.publicUrl}?v=${Date.now()}`

    const result = await upsertCompanyBranding(admin, companyId, {
      logoUrl: cacheBusted,
    })
    if (result.error || !result.data) {
      throw new Error(result.error ?? "No se pudo guardar el logo.")
    }

    return NextResponse.json({
      success: true,
      url: result.data.logoUrl,
      branding: result.data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el logo.",
      },
      { status: 400 }
    )
  }
}
