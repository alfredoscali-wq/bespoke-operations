import type { MikrotikErrorCode } from "@/lib/integrations/mikrotik/types"

export const MIKROTIK_USER_MESSAGES: Record<MikrotikErrorCode, string> = {
  CONNECTION_TIMEOUT: "El MikroTik no respondio dentro del tiempo esperado.",
  CONNECTION_REFUSED: "No se pudo conectar con el MikroTik.",
  AUTHENTICATION_FAILED: "No se pudo autenticar contra el MikroTik.",
  HTTP_ERROR: "El MikroTik respondio con un error HTTP.",
  INVALID_RESPONSE: "El MikroTik devolvio una respuesta invalida.",
  TLS_ERROR: "No se pudo establecer una conexion HTTPS segura con el MikroTik.",
  ROUTER_DISABLED: "La integracion MikroTik esta deshabilitada.",
  PROTOCOL_NOT_IMPLEMENTED:
    "Este protocolo todavia no esta disponible. Use HTTPS / REST.",
  SECRET_MISSING: "Falta la clave de cifrado de credenciales MikroTik.",
  NOT_FOUND: "No se encontro la integracion MikroTik.",
}

export class MikrotikIntegrationError extends Error {
  readonly code: MikrotikErrorCode
  readonly httpStatus: number

  constructor(code: MikrotikErrorCode, httpStatus = 400) {
    super(MIKROTIK_USER_MESSAGES[code])
    this.name = "MikrotikIntegrationError"
    this.code = code
    this.httpStatus = httpStatus
  }
}

export function isMikrotikIntegrationError(
  error: unknown
): error is MikrotikIntegrationError {
  return error instanceof MikrotikIntegrationError
}

const SECRET_KEY_NAMES = new Set([
  "password",
  "password_encrypted",
  "passwordEncrypted",
  "secret",
  "pass",
  "credential",
  "token",
  "authorization",
  "Authorization",
])

export function stripMikrotikSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripMikrotikSecrets)
  }
  if (!value || typeof value !== "object") {
    return value
  }
  const result: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY_NAMES.has(key)) continue
    if (/password|secret|credential|authorization/i.test(key)) continue
    result[key] = stripMikrotikSecrets(nested)
  }
  return result
}

export function sanitizeMikrotikErrorMessage(
  message: string,
  secrets: string[] = []
): string {
  let next = message
  for (const secret of secrets) {
    if (!secret) continue
    next = next.split(secret).join("[redacted]")
  }
  next = next.replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "Basic [redacted]")
  next = next.replace(/password[=:]\s*\S+/gi, "password=[redacted]")
  return next
}

export function classifyMikrotikNetworkError(error: unknown): MikrotikErrorCode {
  if (isMikrotikIntegrationError(error)) {
    return error.code
  }

  const err = error as { name?: string; message?: string; cause?: { code?: string; message?: string } }
  const name = err?.name ?? ""
  const message = String(err?.message ?? "")
  const causeCode = String(err?.cause?.code ?? "")
  const causeMessage = String(err?.cause?.message ?? "")
  const combined = (name + " " + message + " " + causeCode + " " + causeMessage).toLowerCase()

  if (
    name === "AbortError" ||
    name === "TimeoutError" ||
    combined.includes("aborted") ||
    combined.includes("timeout") ||
    combined.includes("und_err_connect_timeout")
  ) {
    return "CONNECTION_TIMEOUT"
  }

  if (
    combined.includes("unable_to_verify") ||
    combined.includes("cert") ||
    combined.includes("ssl") ||
    combined.includes("tls") ||
    combined.includes("eproto")
  ) {
    return "TLS_ERROR"
  }

  if (
    combined.includes("econnrefused") ||
    combined.includes("enotfound") ||
    combined.includes("ehostunreach") ||
    combined.includes("eai_again") ||
    combined.includes("fetch failed")
  ) {
    return "CONNECTION_REFUSED"
  }

  return "CONNECTION_REFUSED"
}
