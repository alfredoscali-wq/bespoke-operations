import { NextResponse } from "next/server"

import {
  ACTIVITY_TIMELINE_PAGE_SIZE,
  type ActivityTimelineStats,
} from "@/lib/activity/activity-timeline-types"
import {
  getActivityEvents,
  getCustomerActivity,
  getEmployeeActivity,
  getProjectActivity,
  getRequestActivity,
  getWorkOrderActivity,
  type ActivityQueryFilters,
  type ActivityQueryResult,
} from "@/lib/activity/query-service"
import { getSessionUser } from "@/lib/auth/session"
import { resolveTenantCompanyId } from "@/lib/operations/tenant-scope"

function optionalParam(value: string | null): string | undefined {
  const normalized = value?.trim() ?? ""
  return normalized || undefined
}

function parseNonNegativeInt(value: string | null, fallback: number): number {
  if (value == null || value.trim() === "") return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

async function resolveScopedQuery(
  companyId: string,
  searchParams: URLSearchParams,
  page: Pick<ActivityQueryFilters, "limit" | "offset" | "order"> &
    Pick<
      ActivityQueryFilters,
      "action" | "dateFrom" | "dateTo" | "search" | "module" | "entityType"
    >
): Promise<ActivityQueryResult> {
  const employeeId = optionalParam(searchParams.get("employeeId"))
  const entityType = optionalParam(searchParams.get("entityType"))
  const entityId = optionalParam(searchParams.get("entityId"))
  const scope = optionalParam(searchParams.get("scope")) ?? "global"

  if (scope === "employee" || (employeeId && !entityId && scope !== "entity")) {
    if (!employeeId) {
      throw new Error("employeeId es obligatorio para el timeline de empleado.")
    }
    return getEmployeeActivity({
      companyId,
      employeeId,
      module: page.module,
      entityType: page.entityType,
      action: page.action,
      dateFrom: page.dateFrom,
      dateTo: page.dateTo,
      search: page.search,
      limit: page.limit,
      offset: page.offset,
      order: page.order,
    })
  }

  if (entityType === "customer" && entityId) {
    return getCustomerActivity({
      companyId,
      customerId: entityId,
      employeeId,
      module: page.module,
      action: page.action,
      dateFrom: page.dateFrom,
      dateTo: page.dateTo,
      search: page.search,
      limit: page.limit,
      offset: page.offset,
      order: page.order,
    })
  }

  if (entityType === "request" && entityId) {
    return getRequestActivity({
      companyId,
      requestId: entityId,
      employeeId,
      action: page.action,
      dateFrom: page.dateFrom,
      dateTo: page.dateTo,
      search: page.search,
      limit: page.limit,
      offset: page.offset,
      order: page.order,
    })
  }

  if (entityType === "workorder" && entityId) {
    return getWorkOrderActivity({
      companyId,
      workOrderId: entityId,
      employeeId,
      action: page.action,
      dateFrom: page.dateFrom,
      dateTo: page.dateTo,
      search: page.search,
      limit: page.limit,
      offset: page.offset,
      order: page.order,
    })
  }

  if (entityType === "project" && entityId) {
    return getProjectActivity({
      companyId,
      projectId: entityId,
      employeeId,
      action: page.action,
      dateFrom: page.dateFrom,
      dateTo: page.dateTo,
      search: page.search,
      limit: page.limit,
      offset: page.offset,
      order: page.order,
    })
  }

  return getActivityEvents({
    companyId,
    employeeId,
    module: page.module,
    entityType,
    entityId,
    action: page.action,
    dateFrom: page.dateFrom,
    dateTo: page.dateTo,
    search: page.search,
    limit: page.limit,
    offset: page.offset,
    order: page.order,
  })
}

async function loadStats(
  companyId: string,
  searchParams: URLSearchParams,
  shared: Pick<
    ActivityQueryFilters,
    "action" | "dateFrom" | "dateTo" | "search" | "module" | "entityType"
  >,
  pageResult: ActivityQueryResult
): Promise<ActivityTimelineStats> {
  if (pageResult.total <= 0) {
    return {
      total: 0,
      firstEventAt: null,
      lastEventAt: null,
    }
  }

  const [oldest, newest] = await Promise.all([
    resolveScopedQuery(companyId, searchParams, {
      ...shared,
      limit: 1,
      offset: 0,
      order: "ASC",
    }),
    resolveScopedQuery(companyId, searchParams, {
      ...shared,
      limit: 1,
      offset: 0,
      order: "DESC",
    }),
  ])

  return {
    total: pageResult.total,
    firstEventAt: oldest.items[0]?.createdAt ?? null,
    lastEventAt: newest.items[0]?.createdAt ?? null,
  }
}

export async function GET(request: Request) {
  const sessionUser = await getSessionUser()

  if (!sessionUser) {
    return NextResponse.json(
      { success: false, message: "Debe iniciar sesión." },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const companyId = resolveTenantCompanyId(sessionUser)
  const limit = parseNonNegativeInt(
    searchParams.get("limit"),
    ACTIVITY_TIMELINE_PAGE_SIZE
  )
  const offset = parseNonNegativeInt(searchParams.get("offset"), 0)

  const shared = {
    module: optionalParam(searchParams.get("module")),
    entityType: optionalParam(searchParams.get("entityType")),
    action: optionalParam(searchParams.get("action")),
    dateFrom: optionalParam(searchParams.get("dateFrom")),
    dateTo: optionalParam(searchParams.get("dateTo")),
    search: optionalParam(searchParams.get("search")),
  }
  const orderParam = optionalParam(searchParams.get("order"))
  const order: "ASC" | "DESC" = orderParam === "ASC" ? "ASC" : "DESC"

  try {
    const result = await resolveScopedQuery(companyId, searchParams, {
      ...shared,
      limit,
      offset,
      order,
    })

    const includeStats = searchParams.get("includeStats") !== "0"
    const stats = includeStats
      ? await loadStats(companyId, searchParams, shared, result)
      : {
          total: result.total,
          firstEventAt: null,
          lastEventAt:
            order === "DESC"
              ? (result.items[0]?.createdAt ?? null)
              : (result.items[result.items.length - 1]?.createdAt ?? null),
        }

    return NextResponse.json({
      success: true,
      items: result.items,
      total: result.total,
      hasMore: result.hasMore,
      limit,
      offset,
      stats,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo cargar el timeline de Activity Engine."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
