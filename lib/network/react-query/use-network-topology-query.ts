"use client"

import { useQuery } from "@tanstack/react-query"

import { isNetworkDiscoveryJobInflight } from "@/lib/network/discovery/job-poll"
import {
  NETWORK_QUERY_OPTIONS,
  NETWORK_UI_REFETCH_INTERVAL_MS,
} from "@/lib/network/react-query/defaults"
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
    discoveryJobs?: NetworkTopologyPage["discoveryJobs"]
    managementTargets?: NetworkTopologyPage["managementTargets"]
    message?: string
  }
  if (!body.success) {
    throw new Error(body.message ?? "No se pudo cargar la topología.")
  }
  return {
    graph: body.graph ?? { nodes: [], edges: [] },
    cores: body.cores ?? [],
    local: body.local ?? null,
    discoveryJobs: body.discoveryJobs ?? [],
    managementTargets: body.managementTargets ?? [],
  }
}

export function useNetworkTopologyQuery(deviceId?: string | null) {
  return useQuery({
    queryKey: deviceId
      ? [...networkQueryKeys.topology(), deviceId]
      : networkQueryKeys.topology(),
    queryFn: () => fetchNetworkTopology(deviceId),
    ...NETWORK_QUERY_OPTIONS,
    refetchInterval: (query) => {
      const jobs = query.state.data?.discoveryJobs ?? []
      if (jobs.some((job) => isNetworkDiscoveryJobInflight(job.status))) {
        return 2_000
      }
      return NETWORK_UI_REFETCH_INTERVAL_MS
    },
  })
}
