import "server-only"

import { DISCOVERY_EXECUTABLE_JOB_TYPE } from "@/lib/network/discovery/contract"
import type { DiscoveryJobExecution } from "@/lib/network/discovery/contract"
import { persistDiscoverySnapshot } from "@/lib/network/devices/queries"
import { parseDiscoverySnapshot } from "@/lib/network/discovery/parse-snapshot"
import {
  MONITORING_EXECUTABLE_JOB_TYPE,
} from "@/lib/network/monitoring/contract"
import { parseMonitoringSnapshot } from "@/lib/network/monitoring/parse-snapshot"
import {
  findDueMonitoringDevice,
  persistMonitoringSnapshot,
} from "@/lib/network/monitoring/queries"
import {
  claimNextPendingNetworkAgentJob,
  completeNetworkAgentJob,
  createPendingNetworkAgentJob,
  getNetworkAgentJob,
  markNetworkAgentJobRunning,
  recoverStaleNetworkAgentJobs,
} from "@/lib/network/jobs/queries"
import {
  compactDiscoveryResult,
  compactMonitoringResult,
  decryptNetworkDeviceSecret,
  stripNetworkSecrets,
} from "@/lib/network/secrets"
import { getNetworkDiscoveryTargetSecretRow } from "@/lib/network/targets/queries"
import { recordNetworkDiscoveryFinishedActivity } from "@/lib/network/activity"
import { recordNetworkDiscoveryFinishedAudit } from "@/lib/network/audit"
import { recordNetworkDeviceStatusChangedActivity } from "@/lib/network/monitoring/activity"
import { recordNetworkDeviceStatusChangedAudit } from "@/lib/network/monitoring/audit"
import {
  NETWORK_API_ERROR_MESSAGES,
  NetworkApiError,
} from "@/lib/network/v1/errors"
import { isNetworkTargetProtocol, isNetworkVendor, resolveTrustedCompanyId } from "@/lib/network/integrity"
import { createAdminClient } from "@/lib/supabase/admin"
import type { NetworkAgentAuth } from "@/lib/network/v1/agent-auth"

type AdminClient = ReturnType<typeof createAdminClient>

async function failClaimedJob(
  admin: AdminClient,
  auth: NetworkAgentAuth,
  jobId: string,
  errorMessage: string
) {
  await completeNetworkAgentJob(admin, {
    companyId: auth.companyId,
    agentId: auth.agentId,
    jobId,
    status: "failed",
    result: null,
    errorMessage,
  })
  return { job: null, execution: null }
}

async function loadJobExecution(
  admin: AdminClient,
  auth: NetworkAgentAuth,
  input: { targetId: string; host: string }
): Promise<DiscoveryJobExecution | { error: string }> {
  const target = await getNetworkDiscoveryTargetSecretRow(
    admin,
    auth.companyId,
    input.targetId
  )

  if (!target || target.agent_id !== auth.agentId) {
    return { error: "El destino no pertenece a este agent." }
  }

  if (!isNetworkVendor(target.vendor) || !isNetworkTargetProtocol(target.protocol)) {
    return { error: "El destino tiene un vendor/protocolo inválido." }
  }

  let password: string
  try {
    password = decryptNetworkDeviceSecret({
      ciphertext: target.secret_ciphertext,
      iv: target.secret_iv,
      tag: target.secret_tag,
    })
  } catch {
    return { error: "No se pudo descifrar la credencial del destino." }
  }

  return {
    vendor: target.vendor,
    host: input.host,
    port: target.port,
    protocol: target.protocol,
    username: target.username,
    password,
  }
}

async function claimOrEnqueueAuthorizedJob(auth: NetworkAgentAuth, admin: AdminClient) {
  const claimed = await claimNextPendingNetworkAgentJob(admin, {
    companyId: auth.companyId,
    agentId: auth.agentId,
  })
  if (claimed) {
    return claimed
  }

  const due = await findDueMonitoringDevice(admin, {
    companyId: auth.companyId,
    agentId: auth.agentId,
  })
  if (!due) {
    return null
  }

  await createPendingNetworkAgentJob(admin, {
    companyId: auth.companyId,
    agentId: auth.agentId,
    siteId: due.siteId,
    jobType: MONITORING_EXECUTABLE_JOB_TYPE,
    payload: {
      deviceId: due.deviceId,
      targetId: due.targetId,
      host: due.host,
    },
  })

  return claimNextPendingNetworkAgentJob(admin, {
    companyId: auth.companyId,
    agentId: auth.agentId,
  })
}

export async function claimAuthorizedNetworkAgentJob(auth: NetworkAgentAuth) {
  const admin = createAdminClient()
  try {
    await recoverStaleNetworkAgentJobs(admin, { companyId: auth.companyId })
  } catch (error) {
    console.error("[Network API] job recovery failed", error)
  }
  const job = await claimOrEnqueueAuthorizedJob(auth, admin)

  if (!job) {
    return { job: null, execution: null }
  }

  const payload = (job.payload ?? {}) as Record<string, unknown>
  const targetId = typeof payload.targetId === "string" ? payload.targetId : ""

  if (job.job_type === DISCOVERY_EXECUTABLE_JOB_TYPE) {
    if (!targetId) {
      return failClaimedJob(admin, auth, job.id, "El job de discovery no tiene un destino autorizado.")
    }

    const target = await getNetworkDiscoveryTargetSecretRow(
      admin,
      auth.companyId,
      targetId
    )
    const host = target?.host
    if (!host) {
      return failClaimedJob(admin, auth, job.id, "El destino de discovery no pertenece a este agent.")
    }

    const execution = await loadJobExecution(admin, auth, { targetId, host })
    if ("error" in execution) {
      return failClaimedJob(admin, auth, job.id, execution.error)
    }

    return {
      job: {
        id: job.id,
        jobType: job.job_type,
        status: job.status,
        payload: stripNetworkSecrets(payload) as Record<string, unknown>,
        siteId: job.site_id,
      },
      execution,
    }
  }

  if (job.job_type === MONITORING_EXECUTABLE_JOB_TYPE) {
    const deviceId = typeof payload.deviceId === "string" ? payload.deviceId : ""
    const host = typeof payload.host === "string" ? payload.host.trim() : ""
    if (!targetId || !deviceId || !host) {
      return failClaimedJob(
        admin,
        auth,
        job.id,
        "El job de monitoring no tiene deviceId, targetId u host autorizados."
      )
    }

    const execution = await loadJobExecution(admin, auth, { targetId, host })
    if ("error" in execution) {
      return failClaimedJob(admin, auth, job.id, execution.error)
    }

    return {
      job: {
        id: job.id,
        jobType: job.job_type,
        status: job.status,
        payload: stripNetworkSecrets(payload) as Record<string, unknown>,
        siteId: job.site_id,
      },
      execution,
    }
  }

  return failClaimedJob(
    admin,
    auth,
    job.id,
    "Este tipo de job todavía no está autorizado para ejecución."
  )
}

export async function startAuthorizedNetworkAgentJob(
  auth: NetworkAgentAuth,
  jobId: string
) {
  const admin = createAdminClient()
  const existing = await getNetworkAgentJob(admin, auth.companyId, jobId)
  if (!existing || existing.agent_id !== auth.agentId) {
    throw new NetworkApiError(
      "JOB_NOT_FOUND",
      NETWORK_API_ERROR_MESSAGES.JOB_NOT_FOUND,
      404
    )
  }

  const running = await markNetworkAgentJobRunning(admin, {
    companyId: auth.companyId,
    agentId: auth.agentId,
    jobId,
  })

  return {
    id: running.id,
    status: running.status,
    jobType: running.job_type,
  }
}

export async function submitNetworkAgentJobResult(input: {
  auth: NetworkAgentAuth
  jobId: string
  body: unknown
  claimedCompanyId?: unknown
}) {
  const companyId = resolveTrustedCompanyId(
    input.auth.companyId,
    input.claimedCompanyId
  )
  const admin = createAdminClient()
  const job = await getNetworkAgentJob(admin, companyId, input.jobId)

  if (!job || job.agent_id !== input.auth.agentId) {
    throw new NetworkApiError(
      "JOB_NOT_FOUND",
      NETWORK_API_ERROR_MESSAGES.JOB_NOT_FOUND,
      404
    )
  }

  if (job.job_type === MONITORING_EXECUTABLE_JOB_TYPE) {
    return submitNetworkMonitoringJobResult(input)
  }

  return submitNetworkDiscoveryJobResult(input)
}

export async function submitNetworkDiscoveryJobResult(input: {
  auth: NetworkAgentAuth
  jobId: string
  body: unknown
  claimedCompanyId?: unknown
}) {
  const companyId = resolveTrustedCompanyId(
    input.auth.companyId,
    input.claimedCompanyId
  )
  const admin = createAdminClient()
  const job = await getNetworkAgentJob(admin, companyId, input.jobId)

  if (!job || job.agent_id !== input.auth.agentId) {
    throw new NetworkApiError(
      "JOB_NOT_FOUND",
      NETWORK_API_ERROR_MESSAGES.JOB_NOT_FOUND,
      404
    )
  }

  if (job.job_type !== DISCOVERY_EXECUTABLE_JOB_TYPE) {
    throw new NetworkApiError(
      "JOB_NOT_EXECUTABLE",
      NETWORK_API_ERROR_MESSAGES.JOB_NOT_EXECUTABLE,
      409
    )
  }

  if (["completed", "failed", "cancelled"].includes(job.status)) {
    throw new NetworkApiError(
      "JOB_NOT_EXECUTABLE",
      "El job ya fue finalizado.",
      409
    )
  }

  const record =
    input.body && typeof input.body === "object" && !Array.isArray(input.body)
      ? (input.body as Record<string, unknown>)
      : {}

  const ok = record.ok !== false
  const errorMessage =
    typeof record.error === "string" && record.error.trim()
      ? record.error.trim()
      : ok
        ? null
        : "El discovery falló."

  if (!ok) {
    const failed = await completeNetworkAgentJob(admin, {
      companyId,
      agentId: input.auth.agentId,
      jobId: input.jobId,
      status: "failed",
      result: compactDiscoveryResult({
        vendor: "mikrotik",
        targetId:
          typeof record.targetId === "string" ? record.targetId : "unknown",
        deviceCount: 0,
        interfaceCount: 0,
        linkCount: 0,
        warnings: [],
        primaryHostname: null,
        primaryManagementIp: null,
      }),
      errorMessage,
    })

    await recordNetworkDiscoveryOutcome({
      companyId,
      agentId: input.auth.agentId,
      agentName: input.auth.name,
      jobId: failed.id,
      ok: false,
      errorMessage,
      hostname: null,
    })

    return { status: failed.status, result: failed.result }
  }

  const parsed = parseDiscoverySnapshot(record.snapshot ?? record)
  if (!parsed.ok) {
    const failed = await completeNetworkAgentJob(admin, {
      companyId,
      agentId: input.auth.agentId,
      jobId: input.jobId,
      status: "failed",
      result: null,
      errorMessage: parsed.message,
    })
    await recordNetworkDiscoveryOutcome({
      companyId,
      agentId: input.auth.agentId,
      agentName: input.auth.name,
      jobId: failed.id,
      ok: false,
      errorMessage: parsed.message,
      hostname: null,
    })
    return { status: failed.status, result: null, message: parsed.message }
  }

  const payload = (job.payload ?? {}) as Record<string, unknown>
  const expectedTargetId =
    typeof payload.targetId === "string" ? payload.targetId : null
  if (expectedTargetId && parsed.snapshot.targetId !== expectedTargetId) {
    throw new NetworkApiError(
      "INVALID_REQUEST",
      "El resultado no corresponde al destino autorizado del job.",
      400
    )
  }

  const persisted = await persistDiscoverySnapshot(admin, {
    companyId,
    agentId: input.auth.agentId,
    siteId: job.site_id,
    snapshot: parsed.snapshot,
  })

  const result = compactDiscoveryResult({
    vendor: parsed.snapshot.vendor,
    targetId: parsed.snapshot.targetId,
    ...persisted,
    warnings: parsed.snapshot.warnings,
  })

  const completed = await completeNetworkAgentJob(admin, {
    companyId,
    agentId: input.auth.agentId,
    jobId: input.jobId,
    status: "completed",
    result,
    errorMessage: null,
  })

  await recordNetworkDiscoveryOutcome({
    companyId,
    agentId: input.auth.agentId,
    agentName: input.auth.name,
    jobId: completed.id,
    ok: true,
    errorMessage: null,
    hostname: persisted.primaryHostname,
  })

  return { status: completed.status, result }
}

export async function submitNetworkMonitoringJobResult(input: {
  auth: NetworkAgentAuth
  jobId: string
  body: unknown
  claimedCompanyId?: unknown
}) {
  const companyId = resolveTrustedCompanyId(
    input.auth.companyId,
    input.claimedCompanyId
  )
  const admin = createAdminClient()
  const job = await getNetworkAgentJob(admin, companyId, input.jobId)

  if (!job || job.agent_id !== input.auth.agentId) {
    throw new NetworkApiError(
      "JOB_NOT_FOUND",
      NETWORK_API_ERROR_MESSAGES.JOB_NOT_FOUND,
      404
    )
  }

  if (job.job_type !== MONITORING_EXECUTABLE_JOB_TYPE) {
    throw new NetworkApiError(
      "JOB_NOT_EXECUTABLE",
      NETWORK_API_ERROR_MESSAGES.JOB_NOT_EXECUTABLE,
      409
    )
  }

  if (["completed", "failed", "cancelled"].includes(job.status)) {
    throw new NetworkApiError(
      "JOB_NOT_EXECUTABLE",
      "El job ya fue finalizado.",
      409
    )
  }

  const record =
    input.body && typeof input.body === "object" && !Array.isArray(input.body)
      ? (input.body as Record<string, unknown>)
      : {}

  const payload = (job.payload ?? {}) as Record<string, unknown>
  const deviceId = typeof payload.deviceId === "string" ? payload.deviceId : ""
  const expectedTargetId = typeof payload.targetId === "string" ? payload.targetId : ""
  const host = typeof payload.host === "string" ? payload.host : ""

  if (!deviceId) {
    throw new NetworkApiError(
      "INVALID_REQUEST",
      "El job de monitoring no tiene un dispositivo autorizado.",
      400
    )
  }

  const ok = record.ok !== false
  const errorMessage =
    typeof record.error === "string" && record.error.trim()
      ? record.error.trim()
      : ok
        ? null
        : "El polling falló."

  if (!ok) {
    const persisted = await persistMonitoringSnapshot(admin, {
      companyId,
      deviceId,
      snapshot: null,
      success: false,
      jobId: input.jobId,
      errorCode: "POLL_FAILED",
      errorMessage,
    })

    const failed = await completeNetworkAgentJob(admin, {
      companyId,
      agentId: input.auth.agentId,
      jobId: input.jobId,
      status: "failed",
      result: compactMonitoringResult({
        vendor: "mikrotik",
        deviceId,
        targetId: expectedTargetId || "unknown",
        host,
        status: persisted.status,
        consecutiveFailures: persisted.consecutiveFailures,
        hostname: null,
        warnings: [],
      }),
      errorMessage,
    })

    await recordMonitoringStatusChange({
      companyId,
      agentId: input.auth.agentId,
      agentName: input.auth.name,
      deviceId,
      previousStatus: persisted.previousStatus,
      nextStatus: persisted.status,
      consecutiveFailures: persisted.consecutiveFailures,
    })

    return { status: failed.status, result: failed.result }
  }

  const parsed = parseMonitoringSnapshot(record.snapshot ?? record)
  if (!parsed.ok) {
    const persisted = await persistMonitoringSnapshot(admin, {
      companyId,
      deviceId,
      snapshot: null,
      success: false,
      jobId: input.jobId,
      errorCode: "INVALID_SNAPSHOT",
      errorMessage: parsed.message,
    })
    const failed = await completeNetworkAgentJob(admin, {
      companyId,
      agentId: input.auth.agentId,
      jobId: input.jobId,
      status: "failed",
      result: null,
      errorMessage: parsed.message,
    })
    await recordMonitoringStatusChange({
      companyId,
      agentId: input.auth.agentId,
      agentName: input.auth.name,
      deviceId,
      previousStatus: persisted.previousStatus,
      nextStatus: persisted.status,
      consecutiveFailures: persisted.consecutiveFailures,
    })
    return { status: failed.status, result: null, message: parsed.message }
  }

  if (parsed.snapshot.deviceId !== deviceId) {
    throw new NetworkApiError(
      "INVALID_REQUEST",
      "El resultado no corresponde al dispositivo autorizado del job.",
      400
    )
  }
  if (expectedTargetId && parsed.snapshot.targetId !== expectedTargetId) {
    throw new NetworkApiError(
      "INVALID_REQUEST",
      "El resultado no corresponde al destino autorizado del job.",
      400
    )
  }

  const persisted = await persistMonitoringSnapshot(admin, {
    companyId,
    deviceId,
    snapshot: parsed.snapshot,
    success: true,
    jobId: input.jobId,
  })

  const result = compactMonitoringResult({
    vendor: parsed.snapshot.vendor,
    deviceId: parsed.snapshot.deviceId,
    targetId: parsed.snapshot.targetId,
    host: parsed.snapshot.host,
    status: persisted.status,
    consecutiveFailures: persisted.consecutiveFailures,
    hostname: parsed.snapshot.hostname,
    warnings: parsed.snapshot.warnings,
  })

  const completed = await completeNetworkAgentJob(admin, {
    companyId,
    agentId: input.auth.agentId,
    jobId: input.jobId,
    status: "completed",
    result,
    errorMessage: null,
  })

  await recordMonitoringStatusChange({
    companyId,
    agentId: input.auth.agentId,
    agentName: input.auth.name,
    deviceId,
    previousStatus: persisted.previousStatus,
    nextStatus: persisted.status,
    consecutiveFailures: persisted.consecutiveFailures,
  })

  return { status: completed.status, result }
}

async function recordNetworkDiscoveryOutcome(input: {
  companyId: string
  agentId: string
  agentName: string
  jobId: string
  ok: boolean
  errorMessage: string | null
  hostname: string | null
}) {
  try {
    await recordNetworkDiscoveryFinishedActivity(input)
    await recordNetworkDiscoveryFinishedAudit(input)
  } catch (error) {
    console.error("[Network API] discovery audit/activity failed", error)
  }
}

async function recordMonitoringStatusChange(input: {
  companyId: string
  agentId: string
  agentName: string
  deviceId: string
  previousStatus: string
  nextStatus: string
  consecutiveFailures: number
}) {
  if (input.previousStatus === input.nextStatus) return
  try {
    await recordNetworkDeviceStatusChangedActivity(input)
    await recordNetworkDeviceStatusChangedAudit(input)
  } catch (error) {
    console.error("[Network API] monitoring audit/activity failed", error)
  }
}
