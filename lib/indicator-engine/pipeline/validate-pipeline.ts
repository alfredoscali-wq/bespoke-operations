import type { ActivityInput } from "@/lib/indicator-engine/pipeline/stages/activity-input"
import type { PipelineContext } from "@/lib/indicator-engine/pipeline/context"
import type { PipelineResult } from "@/lib/indicator-engine/pipeline/result"
import type { IndicatorPipelineStage } from "@/lib/indicator-engine/pipeline/stages"
import { INDICATOR_PIPELINE_STAGES } from "@/lib/indicator-engine/pipeline/stages"
import {
  isSnapshotScope,
  snapshotScopeRequiresSubject,
} from "@/lib/indicator-engine/snapshot/scope"

const BUSINESS_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const STAGE_SET = new Set<string>(INDICATOR_PIPELINE_STAGES)

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

export function isIndicatorPipelineStage(
  value: string
): value is IndicatorPipelineStage {
  return STAGE_SET.has(value)
}

export function validatePipelineContext(context: PipelineContext): string[] {
  const errors: string[] = []

  if (!isNonEmptyString(context.companyId)) {
    errors.push("Pipeline context is missing companyId.")
  }

  if (!isNonEmptyString(context.date) || !BUSINESS_DATE_RE.test(context.date)) {
    errors.push(
      `Pipeline context has invalid business date: "${String(context.date)}".`
    )
  }

  if (!isSnapshotScope(context.scope)) {
    errors.push(
      `Pipeline context has invalid scope: "${String(context.scope)}".`
    )
  } else if (snapshotScopeRequiresSubject(context.scope)) {
    if (!isNonEmptyString(context.subjectId)) {
      errors.push(
        `Pipeline context scope "${context.scope}" requires subjectId.`
      )
    }
  } else if (context.subjectId !== null) {
    errors.push(
      'Pipeline context scope "company" requires subjectId to be null.'
    )
  }

  if (!isNonEmptyString(context.version)) {
    errors.push("Pipeline context is missing version.")
  }

  if (!isNonEmptyString(context.catalogVersion)) {
    errors.push("Pipeline context is missing catalogVersion.")
  }

  if (context.metadata == null || typeof context.metadata !== "object") {
    errors.push("Pipeline context is missing metadata.")
  }

  return errors
}

export function validateActivityInput(input: ActivityInput): string[] {
  const errors: string[] = []

  if (input == null || typeof input !== "object") {
    return ["Activity input is incomplete: missing root object."]
  }

  if (!Array.isArray(input.events)) {
    errors.push("Activity input.events must be an array.")
    return errors
  }

  input.events.forEach((event, index) => {
    if (!event || typeof event !== "object") {
      errors.push(`Activity input.events[${index}] is invalid.`)
      return
    }
    if (!isNonEmptyString(event.module)) {
      errors.push(`Activity input.events[${index}] is missing module.`)
    }
    if (!isNonEmptyString(event.action)) {
      errors.push(`Activity input.events[${index}] is missing action.`)
    }
    if (!isNonEmptyString(event.createdAt)) {
      errors.push(`Activity input.events[${index}] is missing createdAt.`)
    }
    if (event.metadata == null || typeof event.metadata !== "object") {
      errors.push(`Activity input.events[${index}] is missing metadata.`)
    }
  })

  return errors
}

export function validatePipelineResult(result: PipelineResult): string[] {
  const errors: string[] = []

  if (result == null || typeof result !== "object") {
    return ["Pipeline result is incomplete: missing root object."]
  }

  if (!result.context) {
    errors.push("Pipeline result is missing context.")
  } else {
    errors.push(...validatePipelineContext(result.context))
  }

  if (!Array.isArray(result.warnings)) {
    errors.push("Pipeline result.warnings must be an array.")
  }

  if (!Array.isArray(result.errors)) {
    errors.push("Pipeline result.errors must be an array.")
  }

  if (result.metadata == null || typeof result.metadata !== "object") {
    errors.push("Pipeline result is missing metadata.")
  }

  if (result.errors?.length === 0) {
    if (result.snapshot == null) {
      errors.push(
        "Pipeline result is inconsistent: no errors but snapshot is null."
      )
    }
    if (result.digest == null) {
      errors.push(
        "Pipeline result is inconsistent: no errors but digest is null."
      )
    }
    if (result.brief == null) {
      errors.push(
        "Pipeline result is inconsistent: no errors but brief is null."
      )
    }
  }

  return errors
}

export function assertPipelineContextValidInDevelopment(
  context: PipelineContext
): void {
  if (process.env.NODE_ENV === "production") return
  const errors = validatePipelineContext(context)
  if (errors.length === 0) return
  throw new Error(
    [
      "Pipeline context validation failed (development only):",
      ...errors.map((error) => `  - ${error}`),
    ].join("\n")
  )
}

export function assertActivityInputValidInDevelopment(
  input: ActivityInput
): void {
  if (process.env.NODE_ENV === "production") return
  const errors = validateActivityInput(input)
  if (errors.length === 0) return
  throw new Error(
    [
      "Activity input validation failed (development only):",
      ...errors.map((error) => `  - ${error}`),
    ].join("\n")
  )
}

export function assertPipelineResultValidInDevelopment(
  result: PipelineResult
): void {
  if (process.env.NODE_ENV === "production") return
  const errors = validatePipelineResult(result)
  if (errors.length === 0) return
  throw new Error(
    [
      "Pipeline result validation failed (development only):",
      ...errors.map((error) => `  - ${error}`),
    ].join("\n")
  )
}
