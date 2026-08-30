"use client"

import { useQuery } from "@tanstack/react-query"

import { NETWORK_QUERY_OPTIONS } from "@/lib/network/react-query/defaults"
import { networkQueryKeys } from "@/lib/network/react-query/keys"
import type { NetworkDevice } from "@/lib/network/types"

async function fetchNetworkDevices(): Promise<NetworkDevice[]> {
  const response = await fetch("/api/network/devices")
  const body = (await response.json()) as {
    success: boolean
    devices?: NetworkDevice[]
    message?: string
  }
  if (!body.success) {
    throw new Error(body.message ?? "No se pudieron cargar los devices.")
  }
  return body.devices ?? []
}

export function useNetworkDevicesQuery() {
  return useQuery({
    queryKey: networkQueryKeys.devices(),
    queryFn: fetchNetworkDevices,
    ...NETWORK_QUERY_OPTIONS,
  })
}
