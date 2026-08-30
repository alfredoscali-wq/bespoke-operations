import { NextResponse } from "next/server"

import { getNetworkAgent } from "@/lib/network/agents/queries"
import {
  createPendingNetworkAgentJob,
  listNetworkAgentJobs,
} from "@/lib/network/jobs/queries"
import { isNetworkJobType } from "@/lib/network/integrity"
import {
  requireNetworkReadContext,
  requireNetworkWriteContext,
} from "@/lib/network/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ agentId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireNetworkReadContext()
  if (!auth.ok) return auth.response

  const { agentId } = await context.params

  try {
    const client = await createClient()
    const agent = await getNetworkAgent(client, auth.companyId, agentId)
    if (!agent) {
      return NextResponse.json(
        { success: false, message: "Agent no encontrado." },
        { status: 404 }
      )
    }
    const jobs = await listNetworkAgentJobs(client, auth.companyId, agentId)
    return NextResponse.json({ success: true, jobs })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "No se pudieron cargar los jobs.",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireNetworkWriteContext()
  if (!auth.ok) return auth.response

  const { agentId } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  if (!isNetworkJobType(record.jobType)) {
    return NextResponse.json(
      { success: false, message: "El tipo de job no es válido." },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    const agent = await getNetworkAgent(client, auth.companyId, agentId)
    if (!agent) {
      return NextResponse.json(
        { success: false, message: "Agent no encontrado." },
        { status: 404 }
      )
    }

    const payload =
      record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
        ? (record.payload as Record<string, unknown>)
        : {}

    if (record.jobType === "discovery") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Los jobs de discovery se crean desde /network/discovery con un destino MikroTik.",
        },
        { status: 400 }
      )
    }

    const job = await createPendingNetworkAgentJob(client, {
      companyId: auth.companyId,
      agentId: agent.id,
      siteId: agent.siteId,
      jobType: record.jobType,
      payload,
    })

    return NextResponse.json({ success: true, job }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "No se pudo crear el job.",
      },
      { status: 500 }
    )
  }
}
