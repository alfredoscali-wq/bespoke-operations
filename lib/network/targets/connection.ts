import { isNetworkDiscoveryJobInflight } from "@/lib/network/discovery/job-poll"
import { isNetworkTargetDecryptError } from "@/lib/network/management/errors"
import type { NetworkDiscoveryTarget } from "@/lib/network/types"

export const NETWORK_TARGET_AUTH_REJECTED = "Credenciales rechazadas"

export const NETWORK_TARGET_AUTH_ERROR_MESSAGE =
  "Error de autenticación: usuario o contraseña incorrectos."

export const NETWORK_TARGET_DECRYPT_USER_MESSAGE =
  "La credencial no se pudo descifrar. Guardá de nuevo la contraseña."

export const NETWORK_TARGET_CONNECTION_OK_MESSAGE = "Conexión exitosa"

const SECRET_LEAK_PATTERN =
  /password|passwd|secret_ciphertext|secret_iv|secret_tag|ciphertext/i

export const NETWORK_TARGET_CONNECTION_STATUS_LABELS: Record<
  NetworkDiscoveryTarget["connectionStatus"],
  string
> = {
  unknown: "Sin probar",
  pending: "Probando…",
  ok: NETWORK_TARGET_CONNECTION_OK_MESSAGE,
  auth_error: "Error de autenticación",
  error: "Error de conexión",
}

type TargetConnectionJob = {
  jobType?: string
  status: string
  errorMessage?: string | null
  completedAt?: string | null
  createdAt?: string | null
  payload?: Record<string, unknown> | null
  result?: Record<string, unknown> | null
}

export function isNetworkTargetAuthError(
  message: string | null | undefined
): boolean {
  return Boolean(message?.includes(NETWORK_TARGET_AUTH_REJECTED))
}

export function mapNetworkTargetConnectionMessage(
  message: string | null | undefined
): string | null {
  const trimmed = message?.trim() ?? ""
  if (!trimmed) return null
  if (isNetworkTargetAuthError(trimmed)) {
    return NETWORK_TARGET_AUTH_ERROR_MESSAGE
  }
  if (isNetworkTargetDecryptError(trimmed)) {
    return NETWORK_TARGET_DECRYPT_USER_MESSAGE
  }
  if (SECRET_LEAK_PATTERN.test(trimmed)) {
    return "Error de conexión."
  }
  return trimmed
}

function jobTargetId(job: TargetConnectionJob): string | null {
  const payload = job.payload ?? {}
  const result = job.result ?? {}
  const fromPayload =
    typeof payload.targetId === "string" ? payload.targetId.trim() : ""
  if (fromPayload) return fromPayload
  const fromResult =
    typeof result.targetId === "string" ? result.targetId.trim() : ""
  return fromResult || null
}

function jobsForTarget(
  jobs: readonly TargetConnectionJob[],
  targetId: string
): TargetConnectionJob[] {
  return jobs.filter((job) => jobTargetId(job) === targetId)
}

export function attachNetworkDiscoveryTargetConnection(
  targets: NetworkDiscoveryTarget[],
  jobs: readonly TargetConnectionJob[]
): NetworkDiscoveryTarget[] {
  return targets.map((target) => {
    const related = jobsForTarget(jobs, target.id)
    const lastDiscovery = related.find(
      (job) => job.jobType === "discovery" && job.status === "completed"
    )
    const diagnostic = related.find((job) => job.jobType === "diagnostic")
    const connectionJob = diagnostic ?? related[0] ?? null

    let connectionStatus: NetworkDiscoveryTarget["connectionStatus"] = "unknown"
    let connectionMessage: string | null = null

    if (connectionJob) {
      if (isNetworkDiscoveryJobInflight(connectionJob.status)) {
        connectionStatus = "pending"
      } else if (connectionJob.status === "completed") {
        connectionStatus = "ok"
        connectionMessage = NETWORK_TARGET_CONNECTION_OK_MESSAGE
      } else if (
        connectionJob.status === "failed" ||
        connectionJob.status === "cancelled"
      ) {
        connectionMessage = mapNetworkTargetConnectionMessage(
          connectionJob.errorMessage
        )
        connectionStatus = isNetworkTargetAuthError(connectionJob.errorMessage)
          ? "auth_error"
          : "error"
      }
    }

    return {
      ...target,
      connectionStatus,
      connectionMessage,
      lastDiscoveryAt:
        lastDiscovery?.completedAt ?? lastDiscovery?.createdAt ?? null,
    }
  })
}
