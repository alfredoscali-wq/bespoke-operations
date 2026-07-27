import { NextResponse } from "next/server"

import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import {
  reverseGeocodeAddress,
  searchAddressSuggestions,
} from "@/lib/location/search-address"

type SearchAddressBody = {
  query?: string
  latitude?: number
  longitude?: number
}

export async function POST(request: Request) {
  const auth = await requireWritablePlatformSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  let body: SearchAddressBody
  try {
    body = (await request.json()) as SearchAddressBody
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  if (
    typeof body.latitude === "number" &&
    typeof body.longitude === "number" &&
    Number.isFinite(body.latitude) &&
    Number.isFinite(body.longitude)
  ) {
    const suggestion = await reverseGeocodeAddress(
      body.latitude,
      body.longitude
    )
    return NextResponse.json({
      success: true,
      suggestions: suggestion ? [suggestion] : [],
    })
  }

  const query = typeof body.query === "string" ? body.query : ""
  const result = await searchAddressSuggestions(query)

  if (!result.ok) {
    return NextResponse.json(
      { success: false, message: result.message },
      { status: 422 }
    )
  }

  return NextResponse.json({
    success: true,
    suggestions: result.suggestions,
  })
}
