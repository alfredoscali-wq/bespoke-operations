import { NextResponse } from "next/server"

import {
  ISP_CUSTOMER_LIST_LOAD_ERROR,
  customerListErrorMessage,
  isTransientCustomerListError,
} from "@/lib/isp/customer-list-load"
import { requireIspReadContext } from "@/lib/isp/route-context"
import { listIspCustomers } from "@/lib/isp/queries"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const TRANSIENT_RETRY_DELAY_MS = 200

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const search = url.searchParams.get("search") ?? ""
  const status = url.searchParams.get("status") ?? "all"
  const locality = url.searchParams.get("locality") ?? "all"
  const minServices = Number(url.searchParams.get("minServices") ?? "0")
  const minConnections = Number(url.searchParams.get("minConnections") ?? "0")

  const filters = {
    search,
    status,
    locality,
    minServices: Number.isFinite(minServices) ? minServices : 0,
    minConnections: Number.isFinite(minConnections) ? minConnections : 0,
  }

  try {
    const payload = await loadCustomerList(filters)
    if (!payload.ok) return payload.response

    const { customers, localities } = payload.data
    return NextResponse.json({
      success: true,
      customers,
      localities,
      items: customers,
      total: customers.length,
    })
  } catch (error) {
    console.error("[isp/customers] list failed", error)
    return NextResponse.json(
      {
        success: false,
        customers: [],
        localities: [],
        items: [],
        total: 0,
        message: isTransientCustomerListError(error)
          ? ISP_CUSTOMER_LIST_LOAD_ERROR
          : customerListErrorMessage(error),
      },
      { status: 500 }
    )
  }
}

async function loadCustomerList(filters: {
  search: string
  status: string
  locality: string
  minServices: number
  minConnections: number
}) {
  try {
    return await loadCustomerListOnce(filters)
  } catch (error) {
    if (!isTransientCustomerListError(error)) throw error
    await delay(TRANSIENT_RETRY_DELAY_MS)
    return loadCustomerListOnce(filters)
  }
}

async function loadCustomerListOnce(filters: {
  search: string
  status: string
  locality: string
  minServices: number
  minConnections: number
}) {
  const auth = await requireIspReadContext()
  if (!auth.ok) {
    return { ok: false as const, response: auth.response }
  }

  const client = await createClient()
  const data = await listIspCustomers(client, auth.companyId, filters)
  return { ok: true as const, data }
}
