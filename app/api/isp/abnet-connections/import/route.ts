import { NextResponse } from "next/server"

import { denyIfPasswordChangeRequired } from "@/lib/auth/require-password-compliant-session"
import { getSessionUser } from "@/lib/auth/session"
import {
  canConfirmAbnetConnectionImport,
  planAbnetConnectionImport,
} from "@/lib/isp/abnet-connection-registry"
import {
  confirmAbnetConnectionImport,
  loadAbnetConnectionRegistry,
  readAbnetConnectionWorkbook,
} from "@/lib/isp/abnet-connection-registry-source"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

async function readUpload(request: Request) {
  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return { error: "Elegí el archivo conexiones.xlsx." as const }
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  return { file, bytes }
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json(
      { success: false, message: "Debe iniciar sesión para realizar esta acción." },
      { status: 401 }
    )
  }
  const passwordDenial = denyIfPasswordChangeRequired(sessionUser)
  if (passwordDenial) {
    return NextResponse.json(
      { success: false, message: passwordDenial.message },
      { status: passwordDenial.status }
    )
  }
  if (!canConfirmAbnetConnectionImport(sessionUser)) {
    return NextResponse.json(
      { success: false, message: "Solo un administrador puede importar el padrón de conexiones." },
      { status: 403 }
    )
  }
  const companyId = sessionUser.companyId?.trim() ?? ""
  if (!companyId) {
    return NextResponse.json(
      { success: false, message: "Empresa no resuelta para la sesión." },
      { status: 400 }
    )
  }

  const mode = new URL(request.url).searchParams.get("mode")
  const upload = await readUpload(request)
  if ("error" in upload) {
    return NextResponse.json({ success: false, message: upload.error }, { status: 400 })
  }
  const parsed = readAbnetConnectionWorkbook(upload.bytes, upload.file.name)
  const admin = createAdminClient()
  const existing = await loadAbnetConnectionRegistry(admin, companyId)
  if (existing.error && !existing.missing) {
    return NextResponse.json(
      { success: false, message: existing.error.message },
      { status: 400 }
    )
  }
  const plan = planAbnetConnectionImport(existing.records, parsed)
  const preview = {
    sourceName: parsed.sourceName,
    valid: plan.valid,
    invalid: plan.invalid,
    created: plan.created,
    updated: plan.updated,
    unchanged: plan.unchanged,
    issues: plan.issues.slice(0, 20),
  }
  if (mode !== "confirm") {
    return NextResponse.json({ success: true, preview })
  }
  if (existing.missing) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Falta aplicar la migración del padrón de conexiones en el entorno. No se escribió nada.",
        preview,
      },
      { status: 400 }
    )
  }
  if (plan.invalid > 0 || plan.records.length === 0) {
    return NextResponse.json(
      {
        success: false,
        message: "La importación no se confirmó. Corregí las filas inválidas e intentá de nuevo.",
        preview,
      },
      { status: 400 }
    )
  }
  const confirmed = await confirmAbnetConnectionImport(
    admin,
    companyId,
    parsed.sourceName,
    plan.records
  )
  if (confirmed.error) {
    return NextResponse.json(
      { success: false, message: confirmed.error, preview },
      { status: 400 }
    )
  }
  return NextResponse.json({ success: true, preview, result: confirmed.data?.result ?? null })
}
