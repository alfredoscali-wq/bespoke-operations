import { NextResponse } from "next/server"

import { getNetworkAgent } from "@/lib/network/agents/queries"
import { createPendingNetworkAgentJob, listNetworkDiscoveryJobs } from "@/lib/network/jobs/queries"
import {
  findInflightMonitoringJobForDevice,
  resolveMonitoringTargetForDevice,
} from "@/lib/network/monitoring/queries"
import { getNetworkDiscoveryTarget } from "@/lib/network/targets/queries"
import {
  requireNetworkReadContext,
  requireNetworkWriteContext,
} from "@/lib/network/route-context"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const auth = await requireNetworkReadContext()
  if (!auth.ok) return auth.response

  try {
    const client = await createClient()
    const jobs = await listNetworkDiscoveryJobs(client, auth.companyId)
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

export async function POST(request: Request) {
  const auth = await requireNetworkWriteContext()
  if (!auth.ok) return auth.response

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
  const deviceId = typeof record.deviceId === "string" ? record.deviceId.trim() : ""
  const targetId = typeof record.targetId === "string" ? record.targetId.trim() : ""

  if (deviceId) {
    try {
      const client = await createClient()
      const { data: device, error: deviceError } = await client
        .from("network_devices")
        .select("*")
        .eq("company_id", auth.companyId)
        .eq("id", deviceId)
        .is("deleted_at", null)
        .maybeSingle()

      if (deviceError) throw new Error(deviceError.message)
      if (!device) {
        return NextResponse.json(
          { success: false, message: "Dispositivo no encontrado." },
          { status: 404 }
        )
      }
      if (!device.agent_id || !device.management_ip) {
        return NextResponse.json(
          {
            success: false,
            message: "El dispositivo no tiene Agent o IP de gestión para monitorear.",
          },
          { status: 400 }
        )
      }

      const agent = await getNetworkAgent(client, auth.companyId, device.agent_id)
      if (!agent) {
        return NextResponse.json(
          { success: false, message: "Agent no encontrado." },
          { status: 404 }
        )
      }

      const targetResolved = await resolveMonitoringTargetForDevice(client, {
        companyId: auth.companyId,
        agentId: agent.id,
        deviceId: device.id,
      })
      if (!targetResolved) {
        return NextResponse.json(
          {
            success: false,
            message: "No hay un destino MikroTik asociado a este Agent.",
          },
          { status: 400 }
        )
      }

      const inflight = await findInflightMonitoringJobForDevice(client, {
        companyId: auth.companyId,
        agentId: agent.id,
        deviceId: device.id,
      })
      if (inflight) {
        return NextResponse.json({
          success: true,
          job: { id: inflight.id, jobType: inflight.job_type, status: inflight.status },
        })
      }

      const job = await createPendingNetworkAgentJob(client, {
        companyId: auth.companyId,
        agentId: agent.id,
        siteId: device.site_id,
        jobType: "monitoring",
        payload: {
          deviceId: device.id,
          targetId: targetResolved.target.id,
          host: device.management_ip,
        },
      })

      return NextResponse.json({ success: true, job }, { status: 201 })
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message:
            error instanceof Error ? error.message : "No se pudo crear el polling.",
        },
        { status: 500 }
      )
    }
  }

  if (!targetId) {
    return NextResponse.json(
      { success: false, message: "El destino de discovery o el dispositivo son obligatorios." },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    const target = await getNetworkDiscoveryTarget(client, auth.companyId, targetId)
    if (!target) {
      return NextResponse.json(
        { success: false, message: "Destino no encontrado." },
        { status: 404 }
      )
    }

    const agent = await getNetworkAgent(client, auth.companyId, target.agentId)
    if (!agent) {
      return NextResponse.json(
        { success: false, message: "Agent no encontrado." },
        { status: 404 }
      )
    }

    const job = await createPendingNetworkAgentJob(client, {
      companyId: auth.companyId,
      agentId: agent.id,
      siteId: target.siteId,
      jobType: "discovery",
      payload: {
        targetId: target.id,
        vendor: target.vendor,
        host: target.host,
        siteId: target.siteId,
        targetName: target.name,
      },
    })

    return NextResponse.json({ success: true, job }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "No se pudo crear el discovery.",
      },
      { status: 500 }
    )
  }
}

