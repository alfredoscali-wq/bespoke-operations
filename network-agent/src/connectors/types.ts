import type { DiscoverySnapshot } from "@/lib/network/discovery/contract"
import type { MonitoringSnapshot } from "@/lib/network/monitoring/contract"
import type { NetworkTargetProtocol, NetworkVendor } from "@/lib/network/constants"

export type ConnectorAccess = {
  host: string
  port: number
  protocol: NetworkTargetProtocol
  username: string
  password: string
  timeoutMs?: number
}

export type NetworkConnector = {
  vendor: NetworkVendor
  discover(access: ConnectorAccess): Promise<DiscoverySnapshot>
  poll(
    access: ConnectorAccess,
    meta: { deviceId: string }
  ): Promise<MonitoringSnapshot>
}

export class ConnectorError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ConnectorError"
  }
}
