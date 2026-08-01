import type { BusinessSnapshot } from "@/lib/indicator-engine/snapshot/snapshot"
import type { SnapshotIdentity } from "@/lib/indicator-engine/snapshot/identity"
import type { SnapshotPayload } from "@/lib/indicator-engine/snapshot/payload"
import {
  isSnapshotScope,
  snapshotScopeRequiresSubject,
} from "@/lib/indicator-engine/snapshot/scope"
import { isSnapshotStatus } from "@/lib/indicator-engine/snapshot/status"
import { SNAPSHOT_UPDATE_MODES } from "@/lib/indicator-engine/snapshot/payload"

const BUSINESS_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UPDATE_MODES = new Set<string>(SNAPSHOT_UPDATE_MODES)

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

export function validateSnapshotIdentity(
  identity: SnapshotIdentity
): string[] {
  const errors: string[] = []

  if (!isNonEmptyString(identity.companyId)) {
    errors.push("Snapshot identity is missing companyId.")
  }

  if (!isNonEmptyString(identity.date) || !BUSINESS_DATE_RE.test(identity.date)) {
    errors.push(
      `Snapshot identity has invalid business date: "${String(identity.date)}".`
    )
  }

  if (!isSnapshotScope(identity.scope)) {
    errors.push(
      `Snapshot identity has invalid scope: "${String(identity.scope)}".`
    )
  } else if (snapshotScopeRequiresSubject(identity.scope)) {
    if (!isNonEmptyString(identity.subjectId)) {
      errors.push(
        `Snapshot identity scope "${identity.scope}" requires a subjectId.`
      )
    }
  } else if (identity.subjectId !== null) {
    errors.push(
      'Snapshot identity scope "company" requires subjectId to be null.'
    )
  }

  if (!isNonEmptyString(identity.version)) {
    errors.push("Snapshot identity is missing version.")
  }

  return errors
}

export function validateSnapshotPayload(payload: SnapshotPayload): string[] {
  const errors: string[] = []

  if (payload.indicators == null || typeof payload.indicators !== "object") {
    errors.push("Snapshot payload is missing indicators.")
  }

  if (!isSnapshotStatus(payload.status)) {
    errors.push(
      `Snapshot payload has invalid status: "${String(payload.status)}".`
    )
  }

  if (!payload.timestamps) {
    errors.push("Snapshot payload is missing timestamps.")
  } else {
    if (!isNonEmptyString(payload.timestamps.createdAt)) {
      errors.push("Snapshot payload timestamps.createdAt is required.")
    }
    if (!isNonEmptyString(payload.timestamps.updatedAt)) {
      errors.push("Snapshot payload timestamps.updatedAt is required.")
    }
    if (
      payload.timestamps.calculatedAt !== null &&
      !isNonEmptyString(payload.timestamps.calculatedAt)
    ) {
      errors.push(
        "Snapshot payload timestamps.calculatedAt must be ISO string or null."
      )
    }
  }

  if (payload.metadata == null || typeof payload.metadata !== "object") {
    errors.push("Snapshot payload is missing metadata.")
  }

  if (!isNonEmptyString(payload.version)) {
    errors.push("Snapshot payload is missing version.")
  }

  if (
    payload.updateMode !== undefined &&
    !UPDATE_MODES.has(payload.updateMode)
  ) {
    errors.push(
      `Snapshot payload has invalid updateMode: "${String(payload.updateMode)}".`
    )
  }

  return errors
}

/**
 * Validates a complete Business Snapshot (identity + payload).
 * Incomplete / invalid structures produce error messages — no I/O.
 */
export function validateBusinessSnapshot(
  snapshot: BusinessSnapshot
): string[] {
  if (snapshot == null || typeof snapshot !== "object") {
    return ["Snapshot is incomplete: missing root object."]
  }

  const errors: string[] = []

  if (!snapshot.identity) {
    errors.push("Snapshot is incomplete: missing identity.")
  } else {
    errors.push(...validateSnapshotIdentity(snapshot.identity))
  }

  if (!snapshot.payload) {
    errors.push("Snapshot is incomplete: missing payload.")
  } else {
    errors.push(...validateSnapshotPayload(snapshot.payload))
  }

  return errors
}

/**
 * Throws on invalid snapshots in development only.
 * Never throws in production.
 */
export function assertBusinessSnapshotValidInDevelopment(
  snapshot: BusinessSnapshot
): void {
  if (process.env.NODE_ENV === "production") return

  const errors = validateBusinessSnapshot(snapshot)
  if (errors.length === 0) return

  throw new Error(
    [
      "Business Snapshot validation failed (development only):",
      ...errors.map((error) => `  - ${error}`),
    ].join("\n")
  )
}
