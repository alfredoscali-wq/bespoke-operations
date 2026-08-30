import type { DiscoverySnapshot } from "@/lib/network/discovery/contract"
import type { MonitoringSnapshot } from "@/lib/network/monitoring/contract"
import { ConnectorError, type ConnectorAccess, type NetworkConnector } from "../types"
import { connectRouterOsApi, printRecords } from "./api-client"
import { mapMikrotikFactsToSnapshot, type RouterOsFacts } from "./map-discovery"
import { mapMikrotikFactsToMonitoring } from "./map-monitoring"
import { fetchRouterOsMonitoring, fetchRouterOsRest } from "./rest-client"

async function discoverViaApi(access: ConnectorAccess, targetId: string, siteId: string | null) {
  const client = await connectRouterOsApi({
    host: access.host,
    port: access.port,
    username: access.username,
    password: access.password,
    timeoutMs: access.timeoutMs,
  })
  try {
    const identity = (await printRecords(client, "/system/identity/print"))[0] ?? {}
    const resource = (await printRecords(client, "/system/resource/print"))[0] ?? {}
    let routerboard: Record<string, string> = {}
    try {
      routerboard = (await printRecords(client, "/system/routerboard/print"))[0] ?? {}
    } catch {
      routerboard = {}
    }
    const interfaces = await printRecords(client, "/interface/print")
    const addresses = await printRecords(client, "/ip/address/print")
    let neighbors: Record<string, string>[] = []
    try {
      neighbors = await printRecords(client, "/ip/neighbor/print")
    } catch {
      neighbors = []
    }

    const facts: RouterOsFacts = {
      host: access.host,
      targetId,
      siteId,
      identity,
      resource,
      routerboard,
      interfaces,
      addresses,
      neighbors,
    }
    return mapMikrotikFactsToSnapshot(facts)
  } finally {
    client.close()
  }
}

async function discoverViaRest(
  access: ConnectorAccess,
  targetId: string,
  siteId: string | null
) {
  const rest = await fetchRouterOsRest({
    host: access.host,
    port: access.port,
    username: access.username,
    password: access.password,
    timeoutMs: access.timeoutMs,
  })
  return mapMikrotikFactsToSnapshot({
    host: access.host,
    targetId,
    siteId,
    ...rest,
  })
}

async function pollViaApi(
  access: ConnectorAccess,
  targetId: string,
  deviceId: string
): Promise<MonitoringSnapshot> {
  const client = await connectRouterOsApi({
    host: access.host,
    port: access.port,
    username: access.username,
    password: access.password,
    timeoutMs: access.timeoutMs,
  })
  try {
    const identity = (await printRecords(client, "/system/identity/print"))[0] ?? {}
    const resource = (await printRecords(client, "/system/resource/print"))[0] ?? {}
    let health: Record<string, string>[] = []
    try {
      health = await printRecords(client, "/system/health/print")
    } catch {
      health = []
    }
    const interfaces = await printRecords(client, "/interface/print")
    return mapMikrotikFactsToMonitoring({
      host: access.host,
      deviceId,
      targetId,
      identity,
      resource,
      health,
      interfaces,
    })
  } finally {
    client.close()
  }
}

async function pollViaRest(
  access: ConnectorAccess,
  targetId: string,
  deviceId: string
): Promise<MonitoringSnapshot> {
  const rest = await fetchRouterOsMonitoring({
    host: access.host,
    port: access.port,
    username: access.username,
    password: access.password,
    timeoutMs: access.timeoutMs,
  })
  return mapMikrotikFactsToMonitoring({
    host: access.host,
    deviceId,
    targetId,
    ...rest,
  })
}

export function createMikrotikConnector(input: {
  targetId: string
  siteId: string | null
}): NetworkConnector {
  return {
    vendor: "mikrotik",
    async discover(access: ConnectorAccess): Promise<DiscoverySnapshot> {
      if (access.protocol === "rest") {
        return discoverViaRest(access, input.targetId, input.siteId)
      }
      return discoverViaApi(access, input.targetId, input.siteId)
    },
    async poll(
      access: ConnectorAccess,
      meta: { deviceId: string }
    ): Promise<MonitoringSnapshot> {
      try {
        if (access.protocol === "rest") {
          return await pollViaRest(access, input.targetId, meta.deviceId)
        }
        return await pollViaApi(access, input.targetId, meta.deviceId)
      } catch (error) {
        if (error instanceof ConnectorError) throw error
        throw new ConnectorError(
          error instanceof Error ? error.message : "Polling MikroTik falló."
        )
      }
    },
  }
}
