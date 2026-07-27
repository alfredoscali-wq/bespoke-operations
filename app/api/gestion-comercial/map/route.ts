import { NextResponse } from "next/server"

import { CommercialOpportunityService } from "@/lib/commercial/services"
import {
  isCommercialPriorityCode,
  isCommercialSourceCode,
  isCommercialStatusCode,
} from "@/lib/commercial/catalogs"
import { requireGestionComercialReadContext } from "@/lib/commercial/route-context"
import type {
  CommercialMapAssignmentFilter,
  CommercialMapBounds,
  CommercialMapQuery,
} from "@/lib/types/commercial"

function parseNumber(value: string | null): number | null {
  if (value == null || value.trim() === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseBounds(url: URL): CommercialMapBounds | null {
  const north = parseNumber(url.searchParams.get("north"))
  const south = parseNumber(url.searchParams.get("south"))
  const east = parseNumber(url.searchParams.get("east"))
  const west = parseNumber(url.searchParams.get("west"))
  if (
    north == null ||
    south == null ||
    east == null ||
    west == null
  ) {
    return null
  }
  return { north, south, east, west }
}

export async function GET(request: Request) {
  const auth = await requireGestionComercialReadContext()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const bounds = parseBounds(url)
  if (!bounds) {
    return NextResponse.json(
      {
        success: false,
        message: "Debe indicar bounds (north, south, east, west).",
      },
      { status: 400 }
    )
  }

  const assignmentRaw = url.searchParams.get("assignment")?.trim() ?? "all"
  const assignment: CommercialMapAssignmentFilter =
    assignmentRaw === "assigned" || assignmentRaw === "unassigned"
      ? assignmentRaw
      : "all"

  const statusRaw = url.searchParams.get("status")?.trim() ?? ""
  const priorityRaw = url.searchParams.get("priority")?.trim() ?? ""
  const sourceRaw = url.searchParams.get("source")?.trim() ?? ""
  const assignedEmployeeId =
    url.searchParams.get("assignedEmployeeId")?.trim() || null
  const search = url.searchParams.get("search")?.trim() || null

  const query: CommercialMapQuery = {
    bounds,
    assignment,
    assignedEmployeeId,
    status: isCommercialStatusCode(statusRaw) ? statusRaw : null,
    priority: isCommercialPriorityCode(priorityRaw) ? priorityRaw : null,
    source: isCommercialSourceCode(sourceRaw) ? sourceRaw : null,
    search,
  }

  const result = await new CommercialOpportunityService().listMap(
    auth.companyId,
    query
  )

  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: result.error.code === "VALIDATION" ? 400 : 500 }
    )
  }

  return NextResponse.json({
    success: true,
    opportunities: result.data,
  })
}
