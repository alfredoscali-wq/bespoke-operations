import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { MONITORING_EXECUTABLE_JOB_TYPE } from "@/lib/network/monitoring/contract"
import { DISCOVERY_EXECUTABLE_JOB_TYPE } from "@/lib/network/discovery/contract"
import { DIAGNOSTIC_EXECUTABLE_JOB_TYPE } from "@/lib/network/management/vendor"
import { claimJob, heartbeat, startJob, submitJobResult } from "./cloud-client"
import {
  destroyActiveRouterOsSockets,
  isRouterOsApiTlsEnabled,
} from "./connectors/mikrotik/api-client"
import {
  executeDiagnosticJob,
  executeDiscoveryJob,
  executeMonitoringJob,
} from "./discovery/run-job"

const POLL_MS = Number(process.env.NETWORK_AGENT_POLL_MS ?? 5000)

export type AgentLoopDeps = {
  heartbeat: typeof heartbeat
  claimJob: typeof claimJob
  startJob: typeof startJob
  submitJobResult: typeof submitJobResult
  executeMonitoringJob: typeof executeMonitoringJob
  executeDiscoveryJob: typeof executeDiscoveryJob
  executeDiagnosticJob: typeof executeDiagnosticJob
}

const defaultDeps: AgentLoopDeps = {
  heartbeat,
  claimJob,
  startJob,
  submitJobResult,
  executeMonitoringJob,
  executeDiscoveryJob,
  executeDiagnosticJob,
}

let processGuardsInstalled = false
let shutdownRequested = false
let shutdownWaiters: Array<() => void> = []

export function isAgentShutdownRequested() {
  return shutdownRequested
}

export function resetAgentShutdownForTests() {
  shutdownRequested = false
  shutdownWaiters = []
}

/**
 * Finish the current loop iteration, then stop polling.
 * Does not process.exit so an in-flight /result POST can complete.
 */
export function beginAgentShutdown(reason = "signal") {
  if (shutdownRequested) return
  shutdownRequested = true
  console.info("[network-agent] shutdown requested", { reason })
  for (const wake of shutdownWaiters) wake()
  shutdownWaiters = []
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    if (shutdownRequested) {
      resolve()
      return
    }
    const timer = setTimeout(resolve, ms)
    shutdownWaiters.push(() => {
      clearTimeout(timer)
      resolve()
    })
  })
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

  process.on("SIGTERM", () => {
    beginAgentShutdown("SIGTERM")
  })

  process.on("SIGINT", () => {
    beginAgentShutdown("SIGINT")
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

  const jobLog = {
    jobId: claimed.job.id,
    jobType: claimed.job.jobType,
    host: claimed.execution.host,
    port: claimed.execution.port,
    tls: isRouterOsApiTlsEnabled(),
  }

  if (claimed.job.jobType === MONITORING_EXECUTABLE_JOB_TYPE) {
    console.info("[network-agent] monitoring execution started", {
      ...jobLog,
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
        ...jobLog,
        deviceId,
      })
      await deps.submitJobResult({
        jobId: claimed.job.id,
        ok: true,
        snapshot,
      })
      console.info("[network-agent] monitoring completed", {
        ...jobLog,
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
        ...jobLog,
        deviceId,
        error: message,
      })
    }
    return
  }

  if (claimed.job.jobType === DIAGNOSTIC_EXECUTABLE_JOB_TYPE) {
    console.info("[network-agent] diagnostic execution started", jobLog)
    try {
      await deps.executeDiagnosticJob({
        targetId,
        siteId,
        execution: claimed.execution,
      })
      await deps.submitJobResult({
        jobId: claimed.job.id,
        ok: true,
      })
      console.info("[network-agent] diagnostic completed", jobLog)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Diagnóstico falló."
      await deps.submitJobResult({
        jobId: claimed.job.id,
        ok: false,
        error: message,
      })
      console.error("[network-agent] diagnostic failed", {
        ...jobLog,
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
      ...jobLog,
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
      ...jobLog,
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
  while (!shutdownRequested) {
    await runAgentLoopIteration()
    if (shutdownRequested) break
    await sleep(Number.isFinite(POLL_MS) && POLL_MS > 0 ? POLL_MS : 5000)
  }
  destroyActiveRouterOsSockets()
  console.info("[network-agent] shutdown complete")
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
