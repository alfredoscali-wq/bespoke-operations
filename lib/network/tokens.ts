import { createHash, randomBytes } from "node:crypto"

import {
  NETWORK_AGENT_TOKEN_PREFIX,
  NETWORK_ENROLLMENT_TOKEN_PREFIX,
} from "@/lib/network/constants"

export function hashNetworkSecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

export function generateNetworkEnrollmentToken(): string {
  return `${NETWORK_ENROLLMENT_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`
}

export function generateNetworkAgentToken(): string {
  return `${NETWORK_AGENT_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`
}

export function isNetworkEnrollmentToken(value: string): boolean {
  return value.startsWith(NETWORK_ENROLLMENT_TOKEN_PREFIX)
}

export function isNetworkAgentToken(value: string): boolean {
  return value.startsWith(NETWORK_AGENT_TOKEN_PREFIX)
}
