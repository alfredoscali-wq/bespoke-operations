import {
  MIKROTIK_DEFAULT_PORT,
  MIKROTIK_DEFAULT_PROTOCOL,
} from "@/lib/integrations/mikrotik/constants"
import {
  MIKROTIK_PROTOCOLS,
  type MikrotikCreateInput,
  type MikrotikProtocol,
  type MikrotikUpdateInput,
} from "@/lib/integrations/mikrotik/types"

export type MikrotikParseOk<T> = { ok: true; value: T }
export type MikrotikParseErr = { ok: false; message: string }
export type MikrotikParseResult<T> = MikrotikParseOk<T> | MikrotikParseErr

function asRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {}
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function parseProtocol(value: unknown): MikrotikProtocol | null {
  const raw = readString(value)
  if ((MIKROTIK_PROTOCOLS as readonly string[]).includes(raw)) {
    return raw as MikrotikProtocol
  }
  return null
}

function parsePort(value: unknown, fallback: number): number | null {
  if (value === undefined || value === null || value === "") return fallback
  const num = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  if (!Number.isInteger(num) || num < 1 || num > 65535) return null
  return num
}

function parseEnabled(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value
  if (value === undefined || value === null || value === "") return fallback
  return Boolean(value)
}

function validateHost(host: string): string | null {
  if (!host) return "El host o IP es obligatorio."
  if (host.length > 255) return "El host es demasiado largo."
  if (host.includes("://") || host.includes("/") || /\s/.test(host)) {
    return "Ingrese solo el host o IP, sin URL ni ruta."
  }
  return null
}

export function parseMikrotikCreateInput(
  body: unknown
): MikrotikParseResult<MikrotikCreateInput> {
  const record = asRecord(body)
  const name = readString(record.name)
  const host = readString(record.host)
  const username = readString(record.username)
  const password = typeof record.password === "string" ? record.password : ""
  const protocol = parseProtocol(record.protocol) ?? MIKROTIK_DEFAULT_PROTOCOL
  const port = parsePort(
    record.port,
    protocol === "https-rest" ? MIKROTIK_DEFAULT_PORT : 8728
  )
  const enabled = parseEnabled(record.enabled, true)

  if (!name) return { ok: false, message: "El nombre es obligatorio." }
  if (name.length > 120) return { ok: false, message: "El nombre es demasiado largo." }
  const hostError = validateHost(host)
  if (hostError) return { ok: false, message: hostError }
  if (!username) return { ok: false, message: "El usuario es obligatorio." }
  if (!password) return { ok: false, message: "La contrasena es obligatoria." }
  if (port === null) return { ok: false, message: "El puerto es invalido." }

  return {
    ok: true,
    value: { name, host, port, protocol, username, password, enabled },
  }
}

export function parseMikrotikUpdateInput(
  body: unknown
): MikrotikParseResult<MikrotikUpdateInput> {
  const record = asRecord(body)
  const value: MikrotikUpdateInput = {}

  if ("name" in record) {
    const name = readString(record.name)
    if (!name) return { ok: false, message: "El nombre es obligatorio." }
    if (name.length > 120) return { ok: false, message: "El nombre es demasiado largo." }
    value.name = name
  }

  if ("host" in record) {
    const host = readString(record.host)
    const hostError = validateHost(host)
    if (hostError) return { ok: false, message: hostError }
    value.host = host
  }

  if ("protocol" in record) {
    const protocol = parseProtocol(record.protocol)
    if (!protocol) return { ok: false, message: "El protocolo es invalido." }
    value.protocol = protocol
  }

  if ("port" in record) {
    const port = parsePort(record.port, MIKROTIK_DEFAULT_PORT)
    if (port === null) return { ok: false, message: "El puerto es invalido." }
    value.port = port
  }

  if ("username" in record) {
    const username = readString(record.username)
    if (!username) return { ok: false, message: "El usuario es obligatorio." }
    value.username = username
  }

  if ("password" in record) {
    if (typeof record.password !== "string") {
      return { ok: false, message: "La contrasena es invalida." }
    }
    if (record.password.length > 0) {
      value.password = record.password
    }
  }

  if ("enabled" in record) {
    value.enabled = parseEnabled(record.enabled, true)
  }

  return { ok: true, value }
}

export function shouldResetConnectionState(input: MikrotikUpdateInput): boolean {
  return Boolean(
    input.host !== undefined ||
      input.port !== undefined ||
      input.protocol !== undefined ||
      input.username !== undefined ||
      input.password !== undefined
  )
}
