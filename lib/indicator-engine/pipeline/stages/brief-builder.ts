import type { BusinessDigest } from "@/lib/indicator-engine/contracts/digest"
import type { ExecutiveBriefV2 } from "@/lib/indicator-engine/contracts/brief"
import type { BusinessSnapshot } from "@/lib/indicator-engine/snapshot/snapshot"
import type { PipelineStageContract } from "@/lib/indicator-engine/pipeline/stage-contract"

/**
 * Executive Brief Builder — Brief V2 from Snapshot + Digest only.
 * Never accepts activity events.
 */
export type BriefBuilderInput = {
  readonly snapshot: BusinessSnapshot
  readonly digest: BusinessDigest
}

export type BriefBuilderOutput = {
  readonly brief: ExecutiveBriefV2
}

export type BriefBuilderStage = PipelineStageContract<
  BriefBuilderInput,
  BriefBuilderOutput
>

export const briefBuilderStage: BriefBuilderStage = {
  id: "brief_builder",
  name: "Executive Brief Builder",
  description:
    "Projects Snapshot + Business Digest into Executive Brief V2.",
}
