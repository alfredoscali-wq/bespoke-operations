import { NextResponse } from "next/server"

import {
  ISP_COMMERCIAL_COMPONENT_ALREADY_ASSIGNED,
  ISP_COMMERCIAL_COMPONENT_EXCLUSIVE_GROUP,
  ISP_COMMERCIAL_COMPONENT_NOT_FOUND,
  ISP_COMMERCIAL_SERVICE_NOT_FOUND,
  type IspCommercialComponentQuote,
} from "@/lib/isp/commercial-assignment"
import { createIspCommercialAssignmentQueries } from "@/lib/isp/commercial-assignment-queries"
import {
  ISP_COMMERCIAL_COMPONENT_INACTIVE,
  ISP_COMMERCIAL_COMPONENT_INCOMPATIBLE,
} from "@/lib/isp/commercial-pricing"
import {
  isPackFutbolAssignmentEnabled,
  PACK_FUTBOL_ASSIGNMENT_DISABLED_MESSAGE,
  PACK_FUTBOL_CODE,
} from "@/lib/subscriptions/pack-futbol"
import {
  requireSubscriptionsReadContext,
  requireSubscriptionsWriteContext,
} from "@/lib/subscriptions/route-context"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ serviceId: string }> }

const CLIENT_ERRORS = new Set([
  ISP_COMMERCIAL_COMPONENT_INCOMPATIBLE,
  ISP_COMMERCIAL_COMPONENT_INACTIVE,
  ISP_COMMERCIAL_COMPONENT_EXCLUSIVE_GROUP,
  ISP_COMMERCIAL_COMPONENT_NOT_FOUND,
  ISP_COMMERCIAL_COMPONENT_ALREADY_ASSIGNED,
])

function commercialErrorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "No se pudo asignar Pack Fútbol."
  if (message === ISP_COMMERCIAL_SERVICE_NOT_FOUND) {
    return NextResponse.json({ success: false, message }, { status: 404 })
  }
  const status = CLIENT_ERRORS.has(message) ? 400 : 500
  return NextResponse.json({ success: false, message }, { status })
}

function quotePayload(
  quote: IspCommercialComponentQuote,
  status: "available" | "already_active" | "assigned",
  nextMonthlyFee = quote.next.monthlyFee
) {
  return {
    success: true as const,
    status,
    componentCode: quote.componentCode,
    packPrice: quote.packPrice,
    currentMonthlyFee: quote.current.monthlyFee,
    nextMonthlyFee,
    conditionCode: quote.conditionCode,
    discountPercent: quote.discountPercent,
    assignmentEnabled: isPackFutbolAssignmentEnabled(),
  }
}

function disabledAssignmentResponse() {
  return NextResponse.json(
    {
      success: false,
      assignmentEnabled: false,
      message: PACK_FUTBOL_ASSIGNMENT_DISABLED_MESSAGE,
    },
    { status: 403 }
  )
}

async function readServiceId(context: RouteContext) {
  const { serviceId } = await context.params
  return serviceId?.trim() ?? ""
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireSubscriptionsReadContext()
  if (!auth.ok) return auth.response

  const serviceId = await readServiceId(context)
  if (!serviceId) {
    return NextResponse.json(
      { success: false, message: "Servicio no indicado." },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    const queries = createIspCommercialAssignmentQueries(client)
    const quote = await queries.quoteComponentAssignment(auth.companyId, {
      serviceId,
      componentCode: PACK_FUTBOL_CODE,
    })
    return NextResponse.json(quotePayload(quote, quote.status))
  } catch (error) {
    return commercialErrorResponse(error)
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireSubscriptionsWriteContext()
  if (!auth.ok) return auth.response

  const serviceId = await readServiceId(context)
  if (!serviceId) {
    return NextResponse.json(
      { success: false, message: "Servicio no indicado." },
      { status: 400 }
    )
  }

  if (!isPackFutbolAssignmentEnabled()) return disabledAssignmentResponse()

  try {
    const client = await createClient()
    const queries = createIspCommercialAssignmentQueries(client)
    const quote = await queries.quoteComponentAssignment(auth.companyId, {
      serviceId,
      componentCode: PACK_FUTBOL_CODE,
    })
    if (quote.componentCode.trim().toUpperCase() !== PACK_FUTBOL_CODE) {
      return NextResponse.json(
        { success: false, message: ISP_COMMERCIAL_COMPONENT_NOT_FOUND },
        { status: 400 }
      )
    }
    if (quote.status === "already_active") {
      return NextResponse.json(quotePayload(quote, "already_active"))
    }

    try {
      const persisted = await queries.assignComponent(auth.companyId, {
        serviceId,
        componentId: quote.componentId,
      })
      return NextResponse.json(
        quotePayload(quote, "assigned", persisted.monthlyFee)
      )
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === ISP_COMMERCIAL_COMPONENT_ALREADY_ASSIGNED
      ) {
        const current = await queries.quoteComponentAssignment(auth.companyId, {
          serviceId,
          componentCode: PACK_FUTBOL_CODE,
        })
        return NextResponse.json(quotePayload(current, "already_active"))
      }
      throw error
    }
  } catch (error) {
    return commercialErrorResponse(error)
  }
}
