import type {
  BusinessDigest,
  BusinessDigestItem,
} from "@/lib/indicator-engine/contracts/digest"
import { assertBusinessDigestValidInDevelopment } from "@/lib/indicator-engine/contracts/digest"
import type { BusinessSnapshot } from "@/lib/indicator-engine/snapshot/snapshot"
import { assertBusinessSnapshotValidInDevelopment } from "@/lib/indicator-engine/snapshot/validate-snapshot"

export const DEFAULT_DIGEST_LIMIT = 20

export type CreateDigestInput = {
  readonly snapshot: BusinessSnapshot
  /** Optional items; when omitted, a consistent placeholder is used. */
  readonly items?: readonly BusinessDigestItem[]
  readonly limit?: number
  readonly now?: string
}

function placeholderItems(
  snapshot: BusinessSnapshot,
  now: string
): readonly BusinessDigestItem[] {
  const { identity } = snapshot
  return [
    {
      id: `digest-placeholder:${identity.companyId}:${identity.date}:${identity.scope}`,
      createdAt: now,
      action: "snapshot.ready",
      title: "Digest placeholder",
      description:
        "Narrative rules not implemented yet (Indicator Engine Sprint 5).",
      entityType: identity.scope,
      entityId: identity.subjectId,
      employeeId: null,
    },
  ]
}

/**
 * In-memory Digest Builder.
 * No narrative business rules — consistent placeholders only.
 */
export function createDigest(input: CreateDigestInput): BusinessDigest {
  assertBusinessSnapshotValidInDevelopment(input.snapshot)

  const now = input.now ?? new Date().toISOString()
  const limit = input.limit ?? DEFAULT_DIGEST_LIMIT
  const items = input.items ?? placeholderItems(input.snapshot, now)

  const digest: BusinessDigest = {
    identity: { ...input.snapshot.identity },
    items: items.slice(0, limit),
    limit,
    updatedAt: now,
    version: input.snapshot.identity.version,
  }

  assertBusinessDigestValidInDevelopment(digest)
  return digest
}
