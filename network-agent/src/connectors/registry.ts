import type { NetworkVendor } from "@/lib/network/constants"
import type { ConnectorAccess, NetworkConnector } from "./types"
import { ConnectorError } from "./types"
import { createMikrotikConnector } from "./mikrotik"

const FUTURE_VENDORS: NetworkVendor[] = ["ubiquiti", "zte", "huawei", "vsol"]

export function getNetworkConnector(input: {
  vendor: string
  targetId: string
  siteId: string | null
}): NetworkConnector {
  if (input.vendor === "mikrotik") {
    return createMikrotikConnector({
      targetId: input.targetId,
      siteId: input.siteId,
    })
  }

  if (FUTURE_VENDORS.includes(input.vendor as NetworkVendor)) {
    throw new ConnectorError(
      `El connector ${input.vendor} todavía no está implementado.`
    )
  }

  throw new ConnectorError(`Vendor de discovery no soportado: ${input.vendor}`)
}

export function runDiscoveryJob(input: {
  vendor: string
  targetId: string
  siteId: string | null
  access: ConnectorAccess
}) {
  const connector = getNetworkConnector({
    vendor: input.vendor,
    targetId: input.targetId,
    siteId: input.siteId,
  })
  return connector.discover(input.access)
}

export function runMonitoringJob(input: {
  vendor: string
  targetId: string
  siteId: string | null
  deviceId: string
  access: ConnectorAccess
}) {
  const connector = getNetworkConnector({
    vendor: input.vendor,
    targetId: input.targetId,
    siteId: input.siteId,
  })
  return connector.poll(input.access, { deviceId: input.deviceId })
}
