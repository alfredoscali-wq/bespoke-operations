import type { NextResponse } from "next/server"

import { handleNetworkApiError } from "@/lib/network/v1/error-factory"
import {
  createNetworkRequestContext,
  type NetworkRequestContext,
} from "@/lib/network/v1/request-context"
import type { NetworkAgentAuth } from "@/lib/network/v1/agent-auth"
import { requireNetworkAgentAuth } from "@/lib/network/v1/agent-auth"

export async function handlePublicNetworkRoute(
  handler: (context: NetworkRequestContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const context = createNetworkRequestContext()
  try {
    return await handler(context)
  } catch (error) {
    return handleNetworkApiError(context, error)
  }
}

export async function handleProtectedNetworkAgentRoute(
  request: Request,
  handler: (
    context: NetworkRequestContext,
    auth: NetworkAgentAuth
  ) => Promise<NextResponse>
): Promise<NextResponse> {
  const context = createNetworkRequestContext()
  try {
    const auth = await requireNetworkAgentAuth(request)
    return await handler(context, auth)
  } catch (error) {
    return handleNetworkApiError(context, error)
  }
}
