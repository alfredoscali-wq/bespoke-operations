"use client"

import { useQuery } from "@tanstack/react-query"

import { networkQueryKeys } from "@/lib/network/react-query/keys"
import type { NetworkDeviceStatusHistory } from "@/lib/network/types"

async function fetchNetworkDeviceHistory(
  deviceId: string
): Promise<NetworkDeviceStatusHistory> {
  const response = await fetch(`/api/network/devices/${deviceId}/history`)
  const body = (await response.json()) as {
    success: boolean
    events?: NetworkDeviceStatusHistory["events"]
    message?: string
  }
  if (!body.success) {
    throw new Error(body.message ?? "No se pudo cargar el histórico.")
  }
  return { events: body.events ?? [] }
}

export function useNetworkDeviceHistoryQuery(deviceId: string) {
  return useQuery({
    queryKey: networkQueryKeys.deviceHistory(deviceId),
    queryFn: () => fetchNetworkDeviceHistory(deviceId),
    enabled: Boolean(deviceId),
    refetchOnMount: true,
    staleTime: 0,
  })
}
