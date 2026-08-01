import type { SnapshotIdentity } from "@/lib/indicator-engine/snapshot/identity"
import { validateSnapshotIdentity } from "@/lib/indicator-engine/snapshot/validate-snapshot"

/**
 * One prepared narrative item for executive storytelling.
 * Not a full activity_events row — a bounded digest entry.
 */
export type BusinessDigestItem = {
  readonly id: string
  readonly createdAt: string
  readonly action: string
  readonly title: string
  readonly description: string | null
  readonly entityType: string
  readonly entityId: string | null
  readonly employeeId: string | null
}

/**
 * Business Digest — narrative companion to a Business Snapshot.
 *
 * Completely separate from Snapshot payload (which holds indicator data only).
 * Correlated by the same SnapshotIdentity. Never embedded inside a snapshot.
 *
 * Sprint 3: contract only. No persistence.
 */
export type BusinessDigest = {
  readonly identity: SnapshotIdentity
  readonly items: readonly BusinessDigestItem[]
  /** Soft cap applied when the digest was prepared. */
  readonly limit: number
  readonly updatedAt: string
  readonly version: string
}

export type DigestReader = {
  getDigest(identity: SnapshotIdentity): Promise<BusinessDigest | null>
}

export function validateBusinessDigest(digest: BusinessDigest): string[] {
  const errors: string[] = []

  if (digest == null || typeof digest !== "object") {
    return ["Digest is incomplete: missing root object."]
  }

  if (!digest.identity) {
    errors.push("Digest is incomplete: missing identity.")
  } else {
    errors.push(...validateSnapshotIdentity(digest.identity))
  }

  if (!Array.isArray(digest.items)) {
    errors.push("Digest is incomplete: items must be an array.")
  }

  if (typeof digest.limit !== "number" || digest.limit < 0) {
    errors.push("Digest has invalid limit.")
  }

  if (typeof digest.updatedAt !== "string" || !digest.updatedAt.trim()) {
    errors.push("Digest is missing updatedAt.")
  }

  if (typeof digest.version !== "string" || !digest.version.trim()) {
    errors.push("Digest is missing version.")
  }

  return errors
}

export function assertBusinessDigestValidInDevelopment(
  digest: BusinessDigest
): void {
  if (process.env.NODE_ENV === "production") return

  const errors = validateBusinessDigest(digest)
  if (errors.length === 0) return

  throw new Error(
    [
      "Business Digest validation failed (development only):",
      ...errors.map((error) => `  - ${error}`),
    ].join("\n")
  )
}
