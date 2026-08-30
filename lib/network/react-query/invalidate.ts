import type { QueryClient } from "@tanstack/react-query"

import { networkQueryKeys } from "@/lib/network/react-query/keys"

export function invalidateNetworkOperationalQueries(
  queryClient: QueryClient,
  deviceId: string
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: networkQueryKeys.device(deviceId) }),
    queryClient.invalidateQueries({ queryKey: networkQueryKeys.devices(), exact: true }),
    queryClient.invalidateQueries({ queryKey: networkQueryKeys.summary(), exact: true }),
  ])
}
