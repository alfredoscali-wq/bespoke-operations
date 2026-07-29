"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"

import { CommercialSearch } from "@/components/gestion-comercial/search/commercial-search"
import {
  buildCommercialDossierHref,
  type CommercialDossierFrom,
} from "@/lib/commercial/dossier-navigation"
import type { CommercialModuleNavKey } from "@/lib/commercial/module-nav"
import type {
  CommercialSearchGroup,
  CommercialSearchResultItem,
} from "@/lib/types/commercial-search"

function resolveSearchFrom(
  active: CommercialModuleNavKey
): CommercialDossierFrom {
  switch (active) {
    case "inicio":
      return "inicio"
    case "oportunidades":
      return "oportunidades"
    case "pipeline":
      return "pipeline"
    case "territorio":
      return "territorio"
    case "actividad":
      return "actividad"
    default:
      return "inicio"
  }
}

async function fetchCommercialSearchGroups(
  query: string
): Promise<CommercialSearchGroup[]> {
  const response = await fetch(
    `/api/gestion-comercial/search?q=${encodeURIComponent(query)}`
  )
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean
    message?: string
    groups?: CommercialSearchGroup[]
  } | null

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message ?? "No se pudo completar la búsqueda.")
  }

  return payload.groups ?? []
}

type CommercialModuleSearchProps = {
  active: CommercialModuleNavKey
  className?: string
}

/**
 * Wired search for Gestión Comercial screens.
 * Uses the reusable CommercialSearch shell + unified API.
 */
export function CommercialModuleSearch({
  active,
  className,
}: CommercialModuleSearchProps) {
  const router = useRouter()
  const from = resolveSearchFrom(active)

  const search = useCallback((query: string) => {
    return fetchCommercialSearchGroups(query)
  }, [])

  function handleSelect(item: CommercialSearchResultItem) {
    const payload = item.payload ?? {}
    const kind = typeof payload.kind === "string" ? payload.kind : item.category

    if (kind === "client" || item.category === "clients") {
      const opportunityId =
        typeof payload.opportunityId === "string"
          ? payload.opportunityId
          : item.id
      router.push(buildCommercialDossierHref(opportunityId, from))
      return
    }

    if (kind === "activity" || item.category === "activities") {
      const activityId =
        typeof payload.activityId === "string" ? payload.activityId : item.id
      router.push(
        `/gestion-comercial/actividad-comercial?activityId=${encodeURIComponent(activityId)}`
      )
    }
  }

  return (
    <CommercialSearch
      className={className}
      search={search}
      onSelect={handleSelect}
    />
  )
}
