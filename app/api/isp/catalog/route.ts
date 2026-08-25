import { NextResponse } from "next/server"

import {
  createIspCatalogItem,
  listIspCatalog,
} from "@/lib/isp/catalog-queries"
import type { IspCatalogDraft, IspCatalogListFilters } from "@/lib/isp/catalog-types"
import {
  requireIspReadContext,
  requireIspWriteContext,
} from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const auth = await requireIspReadContext()
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const filters: IspCatalogListFilters = {
    search: url.searchParams.get("search") ?? "",
    category: (url.searchParams.get("category") as IspCatalogListFilters["category"]) || "all",
    customerType:
      (url.searchParams.get("customerType") as IspCatalogListFilters["customerType"]) ||
      "all",
    technology:
      (url.searchParams.get("technology") as IspCatalogListFilters["technology"]) ||
      "all",
    status:
      (url.searchParams.get("status") as IspCatalogListFilters["status"]) || "all",
  }

  try {
    const client = await createClient()
    const items = await listIspCatalog(client, auth.companyId, filters)
    return NextResponse.json({ success: true, items })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el catálogo.",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireIspWriteContext()
  if (!auth.ok) return auth.response

  let draft: IspCatalogDraft
  try {
    draft = (await request.json()) as IspCatalogDraft
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    const item = await createIspCatalogItem(client, auth.companyId, draft)
    return NextResponse.json({ success: true, item })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo crear el servicio.",
      },
      { status: 400 }
    )
  }
}
