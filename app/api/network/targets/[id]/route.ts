import { NextResponse } from "next/server"

import { getNetworkAgent } from "@/lib/network/agents/queries"
import { validateNetworkDiscoveryTargetUpdate } from "@/lib/network/integrity"
import {
  requireNetworkReadContext,
  requireNetworkWriteContext,
} from "@/lib/network/route-context"
import { stripNetworkSecrets } from "@/lib/network/secrets"
import { getNetworkSite } from "@/lib/network/sites/queries"
import {
  getNetworkDiscoveryTarget,
  hydrateNetworkDiscoveryTargets,
  softDeleteNetworkDiscoveryTarget,
  updateNetworkDiscoveryTarget,
} from "@/lib/network/targets/queries"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

async function loadHydratedTarget(companyId: string, targetId: string) {
  const client = await createClient()
  const target = await getNetworkDiscoveryTarget(client, companyId, targetId)
  if (!target) return { client, target: null }
  const [hydrated] = await hydrateNetworkDiscoveryTargets(client, companyId, [
    target,
  ])
  return { client, target: hydrated ?? target }
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireNetworkReadContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params

  try {
    const { target } = await loadHydratedTarget(auth.companyId, id)
    if (!target) {
      return NextResponse.json(
        { success: false, message: "Destino no encontrado." },
        { status: 404 }
      )
    }
    return NextResponse.json({
      success: true,
      target: stripNetworkSecrets(target),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el destino.",
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireNetworkWriteContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const parsed = validateNetworkDiscoveryTargetUpdate(
    body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  )
  if (!parsed.ok) {
    return NextResponse.json(
      { success: false, message: parsed.message },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    const existing = await getNetworkDiscoveryTarget(client, auth.companyId, id)
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Destino no encontrado." },
        { status: 404 }
      )
    }

    const agent = await getNetworkAgent(
      client,
      auth.companyId,
      parsed.draft.agentId
    )
    if (!agent) {
      return NextResponse.json(
        { success: false, message: "Agent no encontrado." },
        { status: 404 }
      )
    }

    if (parsed.draft.siteId) {
      const site = await getNetworkSite(
        client,
        auth.companyId,
        parsed.draft.siteId
      )
      if (!site) {
        return NextResponse.json(
          { success: false, message: "Sitio no encontrado." },
          { status: 404 }
        )
      }
    }

    const updated = await updateNetworkDiscoveryTarget(
      client,
      auth.companyId,
      id,
      parsed.draft
    )
    const [hydrated] = await hydrateNetworkDiscoveryTargets(
      client,
      auth.companyId,
      [updated]
    )
    return NextResponse.json({
      success: true,
      message: "Destino actualizado.",
      target: stripNetworkSecrets(hydrated ?? updated),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el destino MikroTik.",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireNetworkWriteContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params

  try {
    const client = await createClient()
    const deleted = await softDeleteNetworkDiscoveryTarget(
      client,
      auth.companyId,
      id
    )
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Destino no encontrado." },
        { status: 404 }
      )
    }
    return NextResponse.json({
      success: true,
      message: "Destino eliminado de Discovery.",
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo eliminar el destino.",
      },
      { status: 500 }
    )
  }
}
