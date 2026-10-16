import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

import {
  MIKROTIK_PASSWORD_PACK_PREFIX,
  MIKROTIK_SECRET_ENV,
} from "@/lib/integrations/mikrotik/constants"

const ALGO = "aes-256-gcm"

function resolveMikrotikSecretKey(): Buffer {
  const explicit = process.env[MIKROTIK_SECRET_ENV]?.trim()
  if (!explicit) {
    throw new Error(
      "Falta BESPOKE_MIKROTIK_SECRET para cifrar credenciales MikroTik."
    )
  }

  if (/^[0-9a-fA-F]{64}$/.test(explicit)) {
    return Buffer.from(explicit, "hex")
  }

  return createHash("sha256").update(explicit, "utf8").digest()
}

export function encryptMikrotikPassword(
  plaintext: string,
  key = resolveMikrotikSecretKey()
): string {
  if (!plaintext) {
    throw new Error("La contrasena MikroTik no puede estar vacia.")
  }

  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [
    MIKROTIK_PASSWORD_PACK_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".")
}

export function decryptMikrotikPassword(
  packed: string,
  key = resolveMikrotikSecretKey()
): string {
  const tokens = packed.split(".")
  if (
    tokens.length !== 5 ||
    tokens[0] !== "aes256gcm" ||
    tokens[1] !== "v1"
  ) {
    throw new Error("Formato de credencial MikroTik invalido.")
  }

  const iv = Buffer.from(tokens[2], "base64url")
  const tag = Buffer.from(tokens[3], "base64url")
  const ciphertext = Buffer.from(tokens[4], "base64url")
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return decrypted.toString("utf8")
}

export function isPackedMikrotikPassword(value: string): boolean {
  const tokens = value.split(".")
  return (
    tokens.length === 5 &&
    tokens[0] === "aes256gcm" &&
    tokens[1] === "v1" &&
    Boolean(tokens[2]) &&
    Boolean(tokens[3]) &&
    Boolean(tokens[4])
  )
}
