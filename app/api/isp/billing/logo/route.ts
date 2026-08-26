import { NextResponse } from "next/server"

import {
  ISP_BILLING_LOGO_BUCKET,
  ISP_BILLING_LOGO_MAX_BYTES,
} from "@/lib/isp/billing-constants"
import { isAllowedBillingLogoFile } from "@/lib/isp/billing-integrity"
import { requireIspBillingWriteContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const auth = await requireIspBillingWriteContext()
  if (!auth.ok) return auth.response

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

  if (
    !isAllowedBillingLogoFile({
      mimeType: file.type,
      size: file.size,
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
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
  const path = `${auth.companyId}/logo.${extension}`

  try {
    const client = await createClient()
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (bytes.byteLength > ISP_BILLING_LOGO_MAX_BYTES) {
      return NextResponse.json(
        { success: false, message: "El logo supera el tamaño máximo." },
        { status: 400 }
      )
    }

    const { error } = await client.storage
      .from(ISP_BILLING_LOGO_BUCKET)
      .upload(path, bytes, {
        contentType: file.type,
        upsert: true,
      })
    if (error) {
      throw error
    }

    const { data } = client.storage
      .from(ISP_BILLING_LOGO_BUCKET)
      .getPublicUrl(path)

    return NextResponse.json({
      success: true,
      url: data.publicUrl,
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
