import { isActivityAction } from "@/lib/activity-engine/activity-actions"
import {
  isActivityCategory,
  isActivityImpact,
  isActivityOrigin,
  type ActivityEngineError,
  type ActivityEngineRecordInput,
} from "@/lib/activity-engine/activity-types"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim())
}

/**
 * Validates a record payload. Returns a controlled error — never inserts.
 */
export function validateActivityRecordInput(
  input: ActivityEngineRecordInput
): ActivityEngineError | null {
  if (!isUuid(input.companyId)) {
    return {
      code: "VALIDATION_ERROR",
      message: "companyId es obligatorio y debe ser un UUID válido.",
      field: "companyId",
    }
  }

  if (!isNonEmptyString(input.module)) {
    return {
      code: "VALIDATION_ERROR",
      message: "module es obligatorio.",
      field: "module",
    }
  }

  if (!isNonEmptyString(input.entityType)) {
    return {
      code: "VALIDATION_ERROR",
      message: "entityType es obligatorio.",
      field: "entityType",
    }
  }

  if (!isUuid(input.entityId)) {
    return {
      code: "VALIDATION_ERROR",
      message: "entityId es obligatorio y debe ser un UUID válido.",
      field: "entityId",
    }
  }

  if (!isActivityAction(input.action)) {
    return {
      code: "VALIDATION_ERROR",
      message: "action no es válida en el catálogo Activity Engine.",
      field: "action",
    }
  }

  if (!isActivityCategory(input.category)) {
    return {
      code: "VALIDATION_ERROR",
      message: "category no es válida.",
      field: "category",
    }
  }

  if (!isActivityImpact(input.impact)) {
    return {
      code: "VALIDATION_ERROR",
      message: "impact no es válido.",
      field: "impact",
    }
  }

  if (!isActivityOrigin(input.origin)) {
    return {
      code: "VALIDATION_ERROR",
      message: "origin no es válido.",
      field: "origin",
    }
  }

  if (
    input.employeeId != null &&
    input.employeeId !== "" &&
    !isUuid(input.employeeId)
  ) {
    return {
      code: "VALIDATION_ERROR",
      message: "employeeId debe ser un UUID válido cuando se informa.",
      field: "employeeId",
    }
  }

  if (
    input.metadata != null &&
    (typeof input.metadata !== "object" || Array.isArray(input.metadata))
  ) {
    return {
      code: "VALIDATION_ERROR",
      message: "metadata debe ser un objeto JSON.",
      field: "metadata",
    }
  }

  return null
}

export function normalizeActivityRecordInput(
  input: ActivityEngineRecordInput
): ActivityEngineRecordInput {
  const title =
    typeof input.title === "string" && input.title.trim()
      ? input.title.trim()
      : null
  const description =
    typeof input.description === "string" && input.description.trim()
      ? input.description.trim()
      : null

  const metadata: Record<string, unknown> = {
    ...(input.metadata ?? {}),
  }
  if (title) metadata.title = title
  if (description) metadata.description = description

  return {
    companyId: input.companyId.trim(),
    module: input.module.trim(),
    entityType: input.entityType.trim(),
    entityId: input.entityId.trim(),
    employeeId:
      input.employeeId == null || input.employeeId === ""
        ? null
        : input.employeeId.trim(),
    action: input.action.trim(),
    category: input.category,
    impact: input.impact,
    origin: input.origin,
    metadata,
    title,
    description,
  }
}
