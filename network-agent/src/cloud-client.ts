import { NETWORK_API_BASE_PATH } from "@/lib/network/v1/constants"
import type { DiscoveryJobExecution } from "@/lib/network/discovery/contract"
import type { DiscoverySnapshot } from "@/lib/network/discovery/contract"
import type { MonitoringSnapshot } from "@/lib/network/monitoring/contract"

type CloudJobClaim = {
  job: {
    id: string
    jobType: string
    status: string
    payload: Record<string, unknown>
    siteId: string | null
  } | null
  execution: DiscoveryJobExecution | null
}

function cloudBaseUrl() {
  return (process.env.NETWORK_CLOUD_URL ?? "http://localhost:3000").replace(/\/$/, "")
}

function agentToken() {
  const token = process.env.NETWORK_AGENT_TOKEN?.trim()
  if (!token) {
    throw new Error("Falta NETWORK_AGENT_TOKEN para el Network Agent.")
  }
  return token
}

function looksLikeJsonBody(contentType: string, raw: string): boolean {
  const trimmed = raw.trim()
  if (contentType.includes("application/json")) return true
  return trimmed.startsWith("{") || trimmed.startsWith("[")
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${cloudBaseUrl()}${path}`
  const method = (init?.method ?? "GET").toUpperCase()
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${agentToken()}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  const contentType = response.headers.get("content-type") ?? ""
  const raw = await response.text()
  const isJson = looksLikeJsonBody(contentType, raw)

  if (!isJson) {
    console.error("[network-agent] cloud response is not JSON", {
      method,
      url,
      status: response.status,
      contentType: contentType || null,
      bodyPreview: raw.slice(0, 100),
    })
    throw new Error(
      `Cloud devolvió ${response.status} no-JSON (${contentType || "sin content-type"}).`
    )
  }

  let body: {
    success: boolean
    data?: T
    error?: { message?: string }
  }
  try {
    body = JSON.parse(raw) as {
      success: boolean
      data?: T
      error?: { message?: string }
    }
  } catch {
    console.error("[network-agent] cloud JSON parse failed", {
      method,
      url,
      status: response.status,
      contentType: contentType || null,
      bodyPreview: raw.slice(0, 100),
    })
    throw new Error("Cloud devolvió un cuerpo que no es JSON válido.")
  }

  if (!response.ok || !body.success) {
    throw new Error(body.error?.message ?? `HTTP ${response.status}`)
  }
  return body.data as T
}

export async function heartbeat(input?: {
  status?: "online" | "degraded"
  version?: string
  hostname?: string
}) {
  return requestJson(`${NETWORK_API_BASE_PATH}/heartbeat`, {
    method: "POST",
    body: JSON.stringify({
      status: input?.status ?? "online",
      version: input?.version ?? "0.1.0-network-agent",
      hostname: input?.hostname ?? null,
    }),
  })
}

export async function claimJob(): Promise<CloudJobClaim> {
  return requestJson<CloudJobClaim>(`${NETWORK_API_BASE_PATH}/jobs`)
}

export async function startJob(jobId: string) {
  return requestJson(`${NETWORK_API_BASE_PATH}/jobs/${jobId}/start`, {
    method: "POST",
    body: "{}",
  })
}

export async function submitJobResult(input: {
  jobId: string
  ok: boolean
  snapshot?: DiscoverySnapshot | MonitoringSnapshot
  error?: string
}) {
  return requestJson(`${NETWORK_API_BASE_PATH}/jobs/${input.jobId}/result`, {
    method: "POST",
    body: JSON.stringify({
      ok: input.ok,
      snapshot: input.snapshot,
      error: input.error,
      targetId: input.snapshot && "targetId" in input.snapshot ? input.snapshot.targetId : undefined,
      deviceId: input.snapshot && "deviceId" in input.snapshot ? input.snapshot.deviceId : undefined,
    }),
  })
}
