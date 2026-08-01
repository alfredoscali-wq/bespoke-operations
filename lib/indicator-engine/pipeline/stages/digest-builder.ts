import type { BusinessDigest } from "@/lib/indicator-engine/contracts/digest"
import type { BusinessSnapshot } from "@/lib/indicator-engine/snapshot/snapshot"
import type { PipelineStageContract } from "@/lib/indicator-engine/pipeline/stage-contract"

/**
 * Business Digest Builder — narrative companion from a snapshot.
 * No storytelling rules implemented in Sprint 4.
 */
export type DigestBuilderInput = {
  readonly snapshot: BusinessSnapshot
}

export type DigestBuilderOutput = {
  readonly digest: BusinessDigest
}

export type DigestBuilderStage = PipelineStageContract<
  DigestBuilderInput,
  DigestBuilderOutput
>

export const digestBuilderStage: DigestBuilderStage = {
  id: "digest_builder",
  name: "Business Digest Builder",
  description:
    "Builds Business Digest narrative correlated to the snapshot identity.",
}
