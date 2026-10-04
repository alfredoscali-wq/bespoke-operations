import { NextResponse } from "next/server"

import { requireNetworkWriteContext } from "@/lib/network/route-context"
import {
  TopologyPlacementError,
  persistCreateTopologyPlacement,
  persistSoftDeleteTopologyPlacement,
  persistUpdateTopologyPlacementParent,
} from "@/lib/network/topology/placements"
import { createClient } from "@/lib/supabase/server"

function jsonError(error: string, status: number, code?: string) {
  return NextResponse.json(
    code ? { success: false, error, code } : { success: false, error },
    { status }
  )
}

function asTrimmedId(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function asNullableId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function asOptionalSortOrder(value: unknown): number | undefined | false {
  if (value === undefined || value === null) return undefined
  if (typeof value !== "number" || !Number.isInteger(value)) return false
  return value
}

function placementErrorStatus(code: TopologyPlacementError["code"]): number {
  if (
    code === "DEVICE_NOT_FOUND" ||
    code === "PARENT_NOT_FOUND" ||
    code === "PLACEMENT_NOT_FOUND"
  ) {
    return 404
  }
  if (code === "DUPLICATE_ACTIVE" || code === "CYCLE" || code === "HAS_CHILDREN") {
    return 409
  }
  return 400
}

function respondPlacementError(error: unknown, fallback: string) {
  if (error instanceof TopologyPlacementError) {
    return jsonError(error.message, placementErrorStatus(error.code), error.code)
  }
  return jsonError(fallback, 500)
}

async function readJsonBody(request: Request): Promise<
  { ok: true; record: Record<string, unknown> } | { ok: false; response: NextResponse }
> {
  try {
    const body = await request.json()
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { ok: false, response: jsonError("Cuerpo JSON inválido.", 400) }
    }
    return { ok: true, record: body as Record<string, unknown> }
  } catch {
    return { ok: false, response: jsonError("Cuerpo JSON inválido.", 400) }
  }
}

export async function POST(request: Request) {
  const auth = await requireNetworkWriteContext()
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response

  const deviceId = asTrimmedId(parsed.record.deviceId)
  if (!deviceId) {
    return jsonError("deviceId es obligatorio.", 400)
  }

  const sortOrder = asOptionalSortOrder(parsed.record.sortOrder)
  if (sortOrder === false) {
    return jsonError("sortOrder debe ser un entero.", 400)
  }

  try {
    const client = await createClient()
    await persistCreateTopologyPlacement(client, {
      companyId: auth.companyId,
      deviceId,
      parentDeviceId: asNullableId(parsed.record.parentDeviceId) ?? null,
      parentInterfaceId: asNullableId(parsed.record.parentInterfaceId) ?? null,
      childInterfaceId: asNullableId(parsed.record.childInterfaceId) ?? null,
      sortOrder,
    })
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    return respondPlacementError(error, "No se pudo crear la colocación.")
  }
}

export async function PATCH(request: Request) {
  const auth = await requireNetworkWriteContext()
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response

  const deviceId = asTrimmedId(parsed.record.deviceId)
  if (!deviceId) {
    return jsonError("deviceId es obligatorio.", 400)
  }
  if (!("parentDeviceId" in parsed.record)) {
    return jsonError("parentDeviceId es obligatorio.", 400)
  }
  if (
    parsed.record.parentDeviceId !== null &&
    typeof parsed.record.parentDeviceId !== "string"
  ) {
    return jsonError("parentDeviceId debe ser un id o null.", 400)
  }

  const sortOrder = asOptionalSortOrder(parsed.record.sortOrder)
  if (sortOrder === false) {
    return jsonError("sortOrder debe ser un entero.", 400)
  }

  try {
    const client = await createClient()
    await persistUpdateTopologyPlacementParent(client, {
      companyId: auth.companyId,
      deviceId,
      parentDeviceId: asNullableId(parsed.record.parentDeviceId) ?? null,
      sortOrder,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return respondPlacementError(error, "No se pudo mover la colocación.")
  }
}

export async function DELETE(request: Request) {
  const auth = await requireNetworkWriteContext()
  if (!auth.ok) return auth.response

  let deviceId = asTrimmedId(new URL(request.url).searchParams.get("deviceId"))
  if (!deviceId) {
    const parsed = await readJsonBody(request)
    if (!parsed.ok) return parsed.response
    deviceId = asTrimmedId(parsed.record.deviceId)
  }
  if (!deviceId) {
    return jsonError("deviceId es obligatorio.", 400)
  }

  try {
    const client = await createClient()
    await persistSoftDeleteTopologyPlacement(client, {
      companyId: auth.companyId,
      deviceId,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return respondPlacementError(error, "No se pudo quitar la colocación.")
  }
}
