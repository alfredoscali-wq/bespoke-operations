"use client"

import { useQuery } from "@tanstack/react-query"

import { NETWORK_QUERY_OPTIONS } from "@/lib/network/react-query/defaults"
import { networkQueryKeys } from "@/lib/network/react-query/keys"
import type { NetworkDeviceDetail } from "@/lib/network/types"

async function fetchNetworkDevice(deviceId: string): Promise<NetworkDeviceDetail> {
  const response = await fetch(`/api/network/devices/${deviceId}`)
  const body = (await response.json()) as {
    success: boolean
    device?: NetworkDeviceDetail
    message?: string
  }
  if (!body.success || !body.device) {
    throw new Error(body.message ?? "No se pudo cargar el dispositivo.")
  }
  return body.device
}

export function useNetworkDeviceQuery(deviceId: string) {
  return useQuery({
    queryKey: networkQueryKeys.device(deviceId),
    queryFn: () => fetchNetworkDevice(deviceId),
    enabled: Boolean(deviceId),
    ...NETWORK_QUERY_OPTIONS,
  })
}
