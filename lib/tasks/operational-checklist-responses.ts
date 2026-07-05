import type { MobileTaskChecklistResponseValue } from "@/lib/mobile/v1/tasks/types"
import type { WorkOrderTypeChecklistItem } from "@/lib/types/work-order-type-checklist"
import type { Task } from "@/lib/types/tasks"
import type { ChecklistFieldType } from "@/lib/work-order-types/checklist-field-types"

export const OPERATIONAL_CHECKLIST_RESPONSES_KEY = "operationalChecklistResponses"

export type OperationalChecklistResponses = Record<
  string,
  MobileTaskChecklistResponseValue
>

export type OperationalChecklistDisplayItem = {
  id: string
  label: string
  fieldType: ChecklistFieldType
  required: boolean
  sortOrder: number
  confirmed: boolean | null
  textValue: string | null
  photoIds: string[]
  hasResponse: boolean
}

export function readOperationalChecklistResponses(
  task: Pick<Task, "taskMetadata">
): OperationalChecklistResponses {
  const raw = task.taskMetadata?.[OPERATIONAL_CHECKLIST_RESPONSES_KEY]

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {}
  }

  const responses: OperationalChecklistResponses = {}

  for (const [itemId, value] of Object.entries(raw)) {
    if (!itemId.trim() || !value || typeof value !== "object" || Array.isArray(value)) {
      continue
    }

    const record = value as Record<string, unknown>
    const confirmed =
      typeof record.confirmed === "boolean" ? record.confirmed : undefined
    const textValue =
      typeof record.textValue === "string" ? record.textValue.trim() : undefined
    const photoIds = Array.isArray(record.photoIds)
      ? record.photoIds.filter((item): item is string => typeof item === "string")
      : undefined

    responses[itemId] = {
      ...(confirmed !== undefined ? { confirmed } : {}),
      ...(textValue !== undefined ? { textValue } : {}),
      ...(photoIds !== undefined ? { photoIds } : {}),
    }
  }

  return responses
}

export function operationalChecklistResponseHasValue(
  fieldType: ChecklistFieldType,
  response: MobileTaskChecklistResponseValue | undefined
): boolean {
  if (!response) {
    return false
  }

  switch (fieldType) {
    case "confirmacion":
      return response.confirmed === true
    case "entrada-datos":
      return Boolean(response.textValue?.trim())
    case "fotografia":
      return (response.photoIds?.length ?? 0) > 0
    default:
      return false
  }
}

export function buildOperationalChecklistDisplayItems(input: {
  template: WorkOrderTypeChecklistItem[]
  responses: OperationalChecklistResponses
  includeUnanswered?: boolean
}): OperationalChecklistDisplayItem[] {
  const { template, responses, includeUnanswered = false } = input
  const items = [...template]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item) => {
      const response = responses[item.id]
      const hasResponse = operationalChecklistResponseHasValue(
        item.fieldType,
        response
      )

      return {
        id: item.id,
        label: item.title,
        fieldType: item.fieldType,
        required: item.required,
        sortOrder: item.sortOrder,
        confirmed: response?.confirmed ?? null,
        textValue: response?.textValue?.trim() || null,
        photoIds: response?.photoIds ?? [],
        hasResponse,
      }
    })

  if (includeUnanswered) {
    return items
  }

  return items.filter((item) => item.hasResponse)
}

export function buildOperationalChecklistDisplayItemsFromResponses(
  responses: OperationalChecklistResponses
): OperationalChecklistDisplayItem[] {
  return Object.entries(responses)
    .map(([id, response], index) => {
      const fieldType: ChecklistFieldType = response.confirmed !== undefined
        ? "confirmacion"
        : response.photoIds && response.photoIds.length > 0
          ? "fotografia"
          : "entrada-datos"

      return {
        id,
        label: id,
        fieldType,
        required: false,
        sortOrder: index + 1,
        confirmed: response.confirmed ?? null,
        textValue: response.textValue?.trim() || null,
        photoIds: response.photoIds ?? [],
        hasResponse: operationalChecklistResponseHasValue(fieldType, response),
      }
    })
    .filter((item) => item.hasResponse)
}

export function resolveOperationalChecklistResponseLabel(
  item: Pick<
    OperationalChecklistDisplayItem,
    "fieldType" | "confirmed" | "textValue" | "photoIds"
  >
): string | null {
  switch (item.fieldType) {
    case "confirmacion":
      if (item.confirmed === true) {
        return "Confirmado"
      }
      if (item.confirmed === false) {
        return "No confirmado"
      }
      return null
    case "entrada-datos":
      return item.textValue
    case "fotografia":
      return item.photoIds.length > 0
        ? `${item.photoIds.length} fotografía${item.photoIds.length === 1 ? "" : "s"}`
        : null
    default:
      return null
  }
}

export function buildTaskMetadataWithResponses(
  task: Pick<Task, "taskMetadata">,
  responses: OperationalChecklistResponses
): Record<string, unknown> {
  return {
    ...task.taskMetadata,
    [OPERATIONAL_CHECKLIST_RESPONSES_KEY]: responses,
  }
}

export function mergeChecklistResponseValue(
  current: MobileTaskChecklistResponseValue | undefined,
  patch: MobileTaskChecklistResponseValue
): MobileTaskChecklistResponseValue {
  return {
    confirmed: patch.confirmed ?? current?.confirmed,
    textValue: patch.textValue ?? current?.textValue,
    photoIds: patch.photoIds ?? current?.photoIds ?? [],
  }
}
