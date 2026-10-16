import { NextResponse } from "next/server"

import {
  isMikrotikIntegrationError,
  MikrotikIntegrationError,
} from "@/lib/integrations/mikrotik/errors"
import { assertNoMikrotikSecrets } from "@/lib/integrations/mikrotik/public"
import type { MikrotikIntegrationPublic } from "@/lib/integrations/mikrotik/types"

export function jsonMikrotikPayload(body: Record<string, unknown>, status = 200) {
  assertNoMikrotikSecrets(body)
  return NextResponse.json(body, { status })
}

export function jsonMikrotikError(error: unknown) {
  const typed = isMikrotikIntegrationError(error)
    ? error
    : new MikrotikIntegrationError("CONNECTION_REFUSED")
  const integration = (error as { integration?: MikrotikIntegrationPublic }).integration
  const payload: Record<string, unknown> = {
    success: false,
    code: typed.code,
    message: typed.message,
  }
  if (integration) {
    payload.integration = integration
  }
  return jsonMikrotikPayload(payload, typed.httpStatus)
}
