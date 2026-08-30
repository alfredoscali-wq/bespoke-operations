import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

const ALGO = "aes-256-gcm"

export type EncryptedNetworkSecret = {
  ciphertext: string
  iv: string
  tag: string
}

function resolveNetworkDeviceSecretKey(): Buffer {
  const explicit = process.env.NETWORK_DEVICE_SECRET_KEY?.trim()
  if (explicit) {
    if (/^[0-9a-fA-F]{64}$/.test(explicit)) {
      return Buffer.from(explicit, "hex")
    }
    return createHash("sha256").update(explicit, "utf8").digest()
  }

  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (fallback) {
    return createHash("sha256").update(fallback, "utf8").digest()
  }

  throw new Error(
    "Falta NETWORK_DEVICE_SECRET_KEY para cifrar credenciales de equipos."
  )
}

export function encryptNetworkDeviceSecret(
  plaintext: string,
  key = resolveNetworkDeviceSecretKey()
): EncryptedNetworkSecret {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  }
}

export function decryptNetworkDeviceSecret(
  secret: EncryptedNetworkSecret,
  key = resolveNetworkDeviceSecretKey()
): string {
  const decipher = createDecipheriv(ALGO, key, Buffer.from(secret.iv, "base64"))
  decipher.setAuthTag(Buffer.from(secret.tag, "base64"))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, "base64")),
    decipher.final(),
  ])
  return decrypted.toString("utf8")
}

const SECRET_KEY_NAMES = new Set([
  "password",
  "secret",
  "pass",
  "credential",
  "token",
  "secretCiphertext",
  "secret_ciphertext",
  "secretIv",
  "secret_iv",
  "secretTag",
  "secret_tag",
])

export function stripNetworkSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripNetworkSecrets)
  }
  if (!value || typeof value !== "object") {
    return value
  }
  const result: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY_NAMES.has(key)) continue
    result[key] = stripNetworkSecrets(nested)
  }
  return result
}

export function compactMonitoringResult(input: {
  vendor: string
  deviceId: string
  targetId: string
  host: string
  status: string
  consecutiveFailures: number
  hostname: string | null
  warnings: string[]
}): Record<string, unknown> {
  return {
    vendor: input.vendor,
    deviceId: input.deviceId,
    targetId: input.targetId,
    host: input.host,
    status: input.status,
    consecutiveFailures: input.consecutiveFailures,
    hostname: input.hostname,
    warnings: input.warnings,
  }
}

export function compactDiscoveryResult(input: {
  vendor: string
  targetId: string
  deviceCount: number
  interfaceCount: number
  linkCount: number
  warnings: string[]
  primaryHostname: string | null
  primaryManagementIp: string | null
}): Record<string, unknown> {
  return {
    vendor: input.vendor,
    targetId: input.targetId,
    deviceCount: input.deviceCount,
    interfaceCount: input.interfaceCount,
    linkCount: input.linkCount,
    warnings: input.warnings,
    primaryHostname: input.primaryHostname,
    primaryManagementIp: input.primaryManagementIp,
  }
}
