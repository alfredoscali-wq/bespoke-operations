import type { PipelineContext } from "@/lib/indicator-engine/pipeline/context"

/**
 * @deprecated Prefer PipelineContext from the pipeline package.
 * Kept as an alias so older in-package imports keep resolving.
 */
export type IndicatorContext = PipelineContext
