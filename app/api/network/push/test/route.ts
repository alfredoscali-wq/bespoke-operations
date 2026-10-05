/**
 * TEMPORARY TEST endpoint.
 * Verifies Production → Firebase Admin → FCM → registered Android tokens.
 * Remove after the production FCM check.
 */

import { NextResponse } from "next/server"

import {
  authorizeNetworkPushTest,
  sendNetworkPushTest,
  toNetworkPushTestResponse,
} from "@/lib/network/push/send-test"
import { requireNetworkWriteContext } from "@/lib/network/route-context"
import { createClient } from "@/lib/supabase/server"

export async function POST() {
  const auth = await requireNetworkWriteContext()
  if (!auth.ok) return auth.response

  const gate = authorizeNetworkPushTest(auth.sessionUser)
  if (!gate.ok) {
    return NextResponse.json(
      { success: false, message: gate.message },
      { status: gate.status }
    )
  }

  try {
    const client = await createClient()
    const result = await sendNetworkPushTest(client, gate.companyId)
    return NextResponse.json(toNetworkPushTestResponse(result))
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "No se pudo enviar la prueba FCM.",
      },
      { status: 500 }
    )
  }
}
