"use client"

import { useQuery } from "@tanstack/react-query"

import { NETWORK_QUERY_OPTIONS } from "@/lib/network/react-query/defaults"
import { networkQueryKeys } from "@/lib/network/react-query/keys"
import type { NetworkHomeSummary, NetworkSite } from "@/lib/network/types"

export type NetworkSummaryQueryResult = {
  summary: NetworkHomeSummary | null
  sites: NetworkSite[]
}

async function fetchNetworkSummary(): Promise<NetworkSummaryQueryResult> {
  const response = await fetch("/api/network/summary")
  const body = (await response.json()) as {
    success: boolean
    summary?: NetworkHomeSummary
    sites?: NetworkSite[]
    message?: string
  }
  if (!body.success) {
    throw new Error(body.message ?? "No se pudo cargar Network.")
  }
  return {
    summary: body.summary ?? null,
    sites: body.sites ?? [],
  }
}

export function useNetworkSummaryQuery() {
  return useQuery({
    queryKey: networkQueryKeys.summary(),
    queryFn: fetchNetworkSummary,
    ...NETWORK_QUERY_OPTIONS,
  })
}
