import { MIKROTIK_REQUEST_TIMEOUT_MS } from "@/lib/integrations/mikrotik/constants"
import {
  classifyMikrotikNetworkError,
  MikrotikIntegrationError,
  sanitizeMikrotikErrorMessage,
} from "@/lib/integrations/mikrotik/errors"
import type {
  MikrotikClientConfig,
  MikrotikHttpFetch,
  MikrotikIdentity,
  MikrotikInterfacesSummary,
  MikrotikSystemResource,
} from "@/lib/integrations/mikrotik/types"

function formatHostForUrl(host: string): string {
  if (host.includes(":") && !host.startsWith("[")) {
    return "[" + host + "]"
  }
  return host
}

function readScalar(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "boolean") return value ? "true" : "false"
  return null
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function unwrapRestObject(data: unknown): Record<string, unknown> {
  if (Array.isArray(data)) {
    const first = data[0]
    if (first && typeof first === "object" && !Array.isArray(first)) {
      return first as Record<string, unknown>
    }
    throw new MikrotikIntegrationError("INVALID_RESPONSE")
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>
  }
  throw new MikrotikIntegrationError("INVALID_RESPONSE")
}

export class MikrotikClient {
  private readonly host: string
  private readonly port: number
  private readonly protocol: MikrotikClientConfig["protocol"]
  private readonly username: string
  private readonly password: string
  private readonly timeoutMs: number
  private readonly fetchImpl: MikrotikHttpFetch

  constructor(config: MikrotikClientConfig) {
    this.host = config.host
    this.port = config.port
    this.protocol = config.protocol
    this.username = config.username
    this.password = config.password
    this.timeoutMs = config.timeoutMs ?? MIKROTIK_REQUEST_TIMEOUT_MS
    this.fetchImpl = config.fetchImpl ?? fetch
  }

  private restUrl(resourcePath: string): string {
    const host = formatHostForUrl(this.host)
    const path = resourcePath.startsWith("/") ? resourcePath : "/" + resourcePath
    return "https://" + host + ":" + this.port + "/rest" + path
  }

  private async requestJson(resourcePath: string): Promise<unknown> {
    if (this.protocol !== "https-rest") {
      throw new MikrotikIntegrationError("PROTOCOL_NOT_IMPLEMENTED")
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    const token = Buffer.from(this.username + ":" + this.password, "utf8").toString("base64")

    try {
      const response = await this.fetchImpl(this.restUrl(resourcePath), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: "Basic " + token,
        },
        signal: controller.signal,
      })

      if (response.status === 401 || response.status === 403) {
        throw new MikrotikIntegrationError("AUTHENTICATION_FAILED", 401)
      }

      if (!response.ok) {
        throw new MikrotikIntegrationError("HTTP_ERROR", 502)
      }

      try {
        return await response.json()
      } catch {
        throw new MikrotikIntegrationError("INVALID_RESPONSE")
      }
    } catch (error) {
      if (error instanceof MikrotikIntegrationError) {
        throw error
      }
      throw new MikrotikIntegrationError(classifyMikrotikNetworkError(error))
    } finally {
      clearTimeout(timer)
    }
  }

  async getIdentity(): Promise<MikrotikIdentity> {
    const payload = unwrapRestObject(await this.requestJson("/system/identity"))
    const name = readScalar(payload.name) ?? readScalar(payload.identity)
    if (!name) {
      throw new MikrotikIntegrationError("INVALID_RESPONSE")
    }
    return { name }
  }

  async getSystemResource(): Promise<MikrotikSystemResource> {
    const payload = unwrapRestObject(await this.requestJson("/system/resource"))
    const version = readScalar(payload.version)
    if (!version) {
      throw new MikrotikIntegrationError("INVALID_RESPONSE")
    }
    return {
      version,
      uptime: readScalar(payload.uptime),
      cpuLoad: readScalar(payload["cpu-load"]),
      freeMemory: readNumber(payload["free-memory"]),
      totalMemory: readNumber(payload["total-memory"]),
      boardName: readScalar(payload["board-name"]),
      architectureName: readScalar(payload["architecture-name"]),
    }
  }

  async getInterfacesSummary(): Promise<MikrotikInterfacesSummary> {
    const payload = await this.requestJson("/interface")
    const rows = Array.isArray(payload) ? payload : [payload]
    let running = 0
    let disabled = 0
    for (const row of rows) {
      if (!row || typeof row !== "object") continue
      const item = row as Record<string, unknown>
      const isDisabled =
        item.disabled === true ||
        item.disabled === "true" ||
        item.disabled === "yes"
      const isRunning =
        item.running === true ||
        item.running === "true" ||
        item.running === "yes"
      if (isDisabled) disabled += 1
      if (isRunning) running += 1
    }
    return {
      total: rows.length,
      running,
      disabled,
    }
  }

  async testConnection() {
    const identity = await this.getIdentity()
    const resource = await this.getSystemResource()
    let interfaces: MikrotikInterfacesSummary | null = null
    try {
      interfaces = await this.getInterfacesSummary()
    } catch (error) {
      void sanitizeMikrotikErrorMessage(String(error), [this.password])
      interfaces = null
    }
    return {
      ok: true as const,
      identity,
      resource,
      interfaces,
      snapshot: {
        identity: identity.name,
        version: resource.version,
        uptime: resource.uptime,
        cpuLoad: resource.cpuLoad,
        freeMemory: resource.freeMemory,
        totalMemory: resource.totalMemory,
        boardName: resource.boardName,
        architectureName: resource.architectureName,
        ...(interfaces ? { interfaces } : {}),
      },
    }
  }
}
