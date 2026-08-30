import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { MONITORING_EXECUTABLE_JOB_TYPE } from "@/lib/network/monitoring/contract"
import { DISCOVERY_EXECUTABLE_JOB_TYPE } from "@/lib/network/discovery/contract"
import { claimJob, heartbeat, startJob, submitJobResult } from "./cloud-client"
import { destroyActiveRouterOsSockets } from "./connectors/mikrotik/api-client"
import { executeDiscoveryJob, executeMonitoringJob } from "./discovery/run-job"

const POLL_MS = Number(process.env.NETWORK_AGENT_POLL_MS ?? 5000)

export type AgentLoopDeps = {
  heartbeat: typeof heartbeat
  claimJob: typeof claimJob
  startJob: typeof startJob
  submitJobResult: typeof submitJobResult
  executeMonitoringJob: typeof executeMonitoringJob
  executeDiscoveryJob: typeof executeDiscoveryJob
}

const defaultDeps: AgentLoopDeps = {
  heartbeat,
  claimJob,
  startJob,
  submitJobResult,
  executeMonitoringJob,
  executeDiscoveryJob,
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function describeFault(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    }
  }
  return {
    name: "UnknownError",
    message: String(error),
    stack: null,
  }
}

let processGuardsInstalled = false

/**
 * Last-resort safety net only. Poll failures must reject as Promises and
 * POST /result from executeMonitoringJob's catch. Do not process.exit here:
 * an in-flight job after /start still needs to report failed.
 */
export function installAgentProcessGuards() {
  if (processGuardsInstalled) return
  processGuardsInstalled = true

  process.on("uncaughtException", (error) => {
    console.error("[network-agent] uncaughtException", describeFault(error))
    destroyActiveRouterOsSockets()
  })

  process.on("unhandledRejection", (reason) => {
    console.error("[network-agent] unhandledRejection", describeFault(reason))
    destroyActiveRouterOsSockets()
  })
}

export async function processOnce(deps: AgentLoopDeps = defaultDeps) {
  await deps.heartbeat({
    status: "online",
    version: "1.0.0-monitoring",
    hostname: os.hostname(),
  })

  const claimed = await deps.claimJob()
  if (!claimed.job || !claimed.execution) {
    return
  }

  const payload = claimed.job.payload
  const targetId = typeof payload.targetId === "string" ? payload.targetId : ""
  const siteId = typeof payload.siteId === "string" ? payload.siteId : claimed.job.siteId
  const deviceId = typeof payload.deviceId === "string" ? payload.deviceId : ""

  await deps.startJob(claimed.job.id)

  if (claimed.job.jobType === MONITORING_EXECUTABLE_JOB_TYPE) {
    console.info("[network-agent] monitoring execution started", {
      jobId: claimed.job.id,
      deviceId,
    })
    try {
      const snapshot = await deps.executeMonitoringJob({
        targetId,
        siteId,
        deviceId,
        execution: claimed.execution,
      })
      console.info("[network-agent] monitoring execution finished", {
        jobId: claimed.job.id,
        deviceId,
      })
      await deps.submitJobResult({
        jobId: claimed.job.id,
        ok: true,
        snapshot,
      })
      console.info("[network-agent] monitoring completed", {
        jobId: claimed.job.id,
        host: claimed.execution.host,
        deviceId,
        cpuLoad: snapshot.cpuLoad,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Polling falló."
      await deps.submitJobResult({
        jobId: claimed.job.id,
        ok: false,
        error: message,
      })
      console.error("[network-agent] monitoring failed", {
        jobId: claimed.job.id,
        host: claimed.execution.host,
        deviceId,
        error: message,
      })
    }
    return
  }

  if (claimed.job.jobType !== DISCOVERY_EXECUTABLE_JOB_TYPE) {
    await deps.submitJobResult({
      jobId: claimed.job.id,
      ok: false,
      error: "Este tipo de job no está soportado por el Agent.",
    })
    return
  }

  try {
    const snapshot = await deps.executeDiscoveryJob({
      targetId,
      siteId,
      execution: claimed.execution,
    })
    await deps.submitJobResult({
      jobId: claimed.job.id,
      ok: true,
      snapshot,
    })
    console.info("[network-agent] discovery completed", {
      jobId: claimed.job.id,
      host: claimed.execution.host,
      devices: snapshot.devices.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discovery falló."
    await deps.submitJobResult({
      jobId: claimed.job.id,
      ok: false,
      error: message,
    })
    console.error("[network-agent] discovery failed", {
      jobId: claimed.job.id,
      host: claimed.execution.host,
      error: message,
    })
  }
}

export async function runAgentLoopIteration(deps: AgentLoopDeps = defaultDeps) {
  try {
    await processOnce(deps)
  } catch (error) {
    console.error(
      "[network-agent]",
      error instanceof Error ? error.message : error
    )
  }
}

export async function main() {
  installAgentProcessGuards()
  console.info("[network-agent] polling Cloud for authorized discovery and monitoring jobs")
  while (true) {
    await runAgentLoopIteration()
    await sleep(Number.isFinite(POLL_MS) && POLL_MS > 0 ? POLL_MS : 5000)
  }
}

function isExecutedAsScript() {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return (
      path.normalize(fileURLToPath(import.meta.url)).toLowerCase() ===
      path.normalize(path.resolve(entry)).toLowerCase()
    )
  } catch {
    return false
  }
}

if (isExecutedAsScript()) {
  void main()
}
