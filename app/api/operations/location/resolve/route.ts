import { NextResponse } from "next/server"

import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import { resolveLocation } from "@/lib/location/resolve-location"

type ResolveLocationBody = {
  sharedLocation?: string
}

export async function POST(request: Request) {
  const auth = await requireWritablePlatformSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  let body: ResolveLocationBody

  try {
    body = (await request.json()) as ResolveLocationBody
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const sharedLocation =
    typeof body.sharedLocation === "string" ? body.sharedLocation : ""

  const result = await resolveLocation(sharedLocation)

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        message: result.message,
        code: result.code,
      },
      { status: 422 }
    )
  }

  return NextResponse.json({
    success: true,
    data: result.data,
  })
}
