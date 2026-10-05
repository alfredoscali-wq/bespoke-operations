import { NextResponse } from "next/server"

import { getNetworkAgent } from "@/lib/network/agents/queries"
import { createPendingNetworkAgentJob } from "@/lib/network/jobs/queries"
import { DIAGNOSTIC_EXECUTABLE_JOB_TYPE } from "@/lib/network/management/vendor"
import { requireNetworkWriteContext } from "@/lib/network/route-context"
import { stripNetworkSecrets } from "@/lib/network/secrets"
import {
  getNetworkDiscoveryTarget,
  hydrateNetworkDiscoveryTargets,
} from "@/lib/network/targets/queries"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireNetworkWriteContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params

  try {
    const client = await createClient()
    const target = await getNetworkDiscoveryTarget(client, auth.companyId, id)
    if (!target) {
      return NextResponse.json(
        { success: false, message: "Destino no encontrado." },
        { status: 404 }
      )
    }
    if (!target.hasSecret) {
      return NextResponse.json(
        {
          success: false,
          message: "El destino no tiene credenciales guardadas.",
        },
        { status: 400 }
      )
    }

    const agent = await getNetworkAgent(client, auth.companyId, target.agentId)
    if (!agent) {
      return NextResponse.json(
        { success: false, message: "Agent no encontrado." },
        { status: 404 }
      )
    }
    if (agent.status === "offline" || agent.status === "pending") {
      return NextResponse.json(
        { success: false, message: "El Agent no está disponible." },
        { status: 409 }
      )
    }

    const job = await createPendingNetworkAgentJob(client, {
      companyId: auth.companyId,
      agentId: agent.id,
      siteId: target.siteId,
      jobType: DIAGNOSTIC_EXECUTABLE_JOB_TYPE,
      payload: {
        targetId: target.id,
        vendor: target.vendor,
        host: target.host,
        siteId: target.siteId,
        targetName: target.name,
      },
    })

    const [hydrated] = await hydrateNetworkDiscoveryTargets(client, auth.companyId, [
      target,
    ])

    return NextResponse.json(
      {
        success: true,
        job: stripNetworkSecrets(job),
        target: stripNetworkSecrets(hydrated ?? target),
      },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo probar la conexión.",
      },
      { status: 500 }
    )
  }
}
