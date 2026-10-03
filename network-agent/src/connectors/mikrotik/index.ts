import type { DiscoverySnapshot } from "@/lib/network/discovery/contract"
import type { MonitoringSnapshot } from "@/lib/network/monitoring/contract"
import { ConnectorError, type ConnectorAccess, type NetworkConnector } from "../types"
import { connectRouterOsApi, printRecords } from "./api-client"
import { mapMikrotikFactsToSnapshot, type RouterOsFacts } from "./map-discovery"
import { mapMikrotikFactsToMonitoring } from "./map-monitoring"
import { fetchRouterOsMonitoring, fetchRouterOsRest } from "./rest-client"

function connectApi(access: ConnectorAccess) {
  return connectRouterOsApi({
    host: access.host,
    port: access.port,
    protocol: access.protocol,
    username: access.username,
    password: access.password,
    timeoutMs: access.timeoutMs,
  })
}

async function testViaApi(access: ConnectorAccess) {
  const client = await connectApi(access)
  try {
    await printRecords(client, "/system/identity/print")
  } finally {
    client.close()
  }
}

async function discoverViaApi(access: ConnectorAccess, targetId: string, siteId: string | null) {
  const client = await connectApi(access)
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
    let arp: Record<string, string>[] = []
    try {
      arp = await printRecords(client, "/ip/arp/print")
    } catch {
      arp = []
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
      arp,
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
  const client = await connectApi(access)
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

function mapTestConnectionError(
  error: unknown,
  access: ConnectorAccess
): ConnectorError {
  const raw = error instanceof Error ? error.message : ""
  const lower = raw.toLowerCase()
  if (
    /invalid user|cannot log in|login failure|incorrect password|bad name/.test(
      lower
    )
  ) {
    return new ConnectorError("Credenciales rechazadas")
  }
  if (
    /econnrefused|etimedout|timeout|enotfound|ehostunreach|socket closed|network unreachable/.test(
      lower
    )
  ) {
    return new ConnectorError(
      `No fue posible conectar con ${access.host}:${access.port}`
    )
  }
  if (/api/.test(lower) && /not respond|unavailable|refused/.test(lower)) {
    return new ConnectorError("El servicio API no responde")
  }
  if (error instanceof ConnectorError) return error
  return new ConnectorError(
    raw || `No fue posible conectar con ${access.host}:${access.port}`
  )
}

export function createMikrotikConnector(input: {
  targetId: string
  siteId: string | null
}): NetworkConnector {
  return {
    vendor: "mikrotik",
    async testConnection(access: ConnectorAccess): Promise<void> {
      try {
        if (access.protocol === "rest") {
          await fetchRouterOsRest({
            host: access.host,
            port: access.port,
            username: access.username,
            password: access.password,
            timeoutMs: access.timeoutMs,
          })
          return
        }
        await testViaApi(access)
      } catch (error) {
        throw mapTestConnectionError(error, access)
      }
    },
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
