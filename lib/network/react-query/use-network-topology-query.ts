"use client"

import { useQuery } from "@tanstack/react-query"

import { networkQueryKeys } from "@/lib/network/react-query/keys"
import type { NetworkTopologyGraph } from "@/lib/network/topology/types"

async function fetchNetworkTopology(): Promise<NetworkTopologyGraph> {
  const response = await fetch("/api/network/topology")
  const body = (await response.json()) as {
    success: boolean
    graph?: NetworkTopologyGraph
    message?: string
  }
  if (!body.success) {
    throw new Error(body.message ?? "No se pudo cargar la topología.")
  }
  return body.graph ?? { nodes: [], edges: [] }
}

export function useNetworkTopologyQuery() {
  return useQuery({
    queryKey: networkQueryKeys.topology(),
    queryFn: fetchNetworkTopology,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: Infinity,
  })
}
