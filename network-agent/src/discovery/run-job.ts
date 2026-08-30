import type { DiscoveryJobExecution } from "@/lib/network/discovery/contract"
import { runDiscoveryJob, runMonitoringJob } from "../connectors/registry"
import type { ConnectorAccess } from "../connectors/types"

function toAccess(execution: DiscoveryJobExecution): ConnectorAccess {
  return {
    host: execution.host,
    port: execution.port,
    protocol: execution.protocol,
    username: execution.username,
    password: execution.password,
  }
}

export async function executeDiscoveryJob(input: {
  targetId: string
  siteId: string | null
  execution: DiscoveryJobExecution
}) {
  return runDiscoveryJob({
    vendor: input.execution.vendor,
    targetId: input.targetId,
    siteId: input.siteId,
    access: toAccess(input.execution),
  })
}

export async function executeMonitoringJob(input: {
  targetId: string
  siteId: string | null
  deviceId: string
  execution: DiscoveryJobExecution
}) {
  return runMonitoringJob({
    vendor: input.execution.vendor,
    targetId: input.targetId,
    siteId: input.siteId,
    deviceId: input.deviceId,
    access: toAccess(input.execution),
  })
}
