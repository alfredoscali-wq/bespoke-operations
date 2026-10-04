"use client"

import { useQuery } from "@tanstack/react-query"

import {
  NETWORK_QUERY_OPTIONS,
  NETWORK_UI_REFETCH_INTERVAL_MS,
} from "@/lib/network/react-query/defaults"
import { networkQueryKeys } from "@/lib/network/react-query/keys"
import type { NocMonitorPage } from "@/lib/network/noc/types"

async function fetchNocMonitorPage(): Promise<NocMonitorPage> {
  const response = await fetch("/api/network/noc")
  const body = (await response.json()) as {
    success?: boolean
    companyName?: string
    summary?: NocMonitorPage["summary"]
    topology?: NocMonitorPage["topology"]
    alarms?: NocMonitorPage["alarms"]
    lastUpdatedAt?: string
    message?: string
  }
  if (!body.success) {
    throw new Error(body.message ?? "No se pudo cargar el monitor NOC.")
  }
  return {
    companyName: body.companyName ?? "Empresa",
    summary: body.summary ?? {
      deviceCount: 0,
      onlineCount: 0,
      attentionCount: 0,
      offlineCount: 0,
      activeAlarmCount: 0,
    },
    topology: body.topology ?? { roots: [] },
    alarms: body.alarms ?? [],
    lastUpdatedAt: body.lastUpdatedAt ?? new Date().toISOString(),
  }
}

export function useNetworkNocQuery() {
  return useQuery({
    queryKey: networkQueryKeys.noc(),
    queryFn: fetchNocMonitorPage,
    ...NETWORK_QUERY_OPTIONS,
    refetchInterval: NETWORK_UI_REFETCH_INTERVAL_MS,
  })
}
