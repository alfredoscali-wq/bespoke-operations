"use client"

import { useQuery } from "@tanstack/react-query"

import { NETWORK_QUERY_OPTIONS } from "@/lib/network/react-query/defaults"
import { networkQueryKeys } from "@/lib/network/react-query/keys"
import type { NetworkTopologyPage } from "@/lib/network/topology/types"

async function fetchNetworkTopology(
  deviceId?: string | null
): Promise<NetworkTopologyPage> {
  const response = deviceId
    ? await fetch(
        `/api/network/topology?deviceId=${encodeURIComponent(deviceId)}`
      )
    : await fetch("/api/network/topology")
  const body = (await response.json()) as {
    success: boolean
    graph?: NetworkTopologyPage["graph"]
    cores?: NetworkTopologyPage["cores"]
    local?: NetworkTopologyPage["local"]
    message?: string
  }
  if (!body.success) {
    throw new Error(body.message ?? "No se pudo cargar la topología.")
  }
  return {
    graph: body.graph ?? { nodes: [], edges: [] },
    cores: body.cores ?? [],
    local: body.local ?? null,
  }
}

export function useNetworkTopologyQuery(deviceId?: string | null) {
  return useQuery({
    queryKey: deviceId
      ? [...networkQueryKeys.topology(), deviceId]
      : networkQueryKeys.topology(),
    queryFn: () => fetchNetworkTopology(deviceId),
    ...NETWORK_QUERY_OPTIONS,
  })
}
