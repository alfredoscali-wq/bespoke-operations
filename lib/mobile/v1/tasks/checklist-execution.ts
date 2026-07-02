import "server-only"

import { fetchOperationalChecklistForServiceType } from "@/lib/mobile/v1/checklist/checklist-queries"
import type { MobileOperationalChecklistItem } from "@/lib/mobile/v1/checklist/types"
import type {
  MobileTaskChecklistItem,
  MobileTaskChecklistResponseValue,
} from "@/lib/mobile/v1/tasks/types"
import type { Task } from "@/lib/types/tasks"
import type { SupabaseClient } from "@supabase/supabase-js"

export const OPERATIONAL_CHECKLIST_RESPONSES_KEY = "operationalChecklistResponses"

export type OperationalChecklistResponses = Record<
  string,
  MobileTaskChecklistResponseValue
>

export function readOperationalChecklistResponses(
  task: Task
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

export function isOperationalChecklistItemComplete(
  item: MobileOperationalChecklistItem,
  response: MobileTaskChecklistResponseValue | undefined
): boolean {
  if (!response) {
    return false
  }

  switch (item.fieldType) {
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

export function validateOperationalChecklistComplete(
  template: MobileOperationalChecklistItem[],
  responses: OperationalChecklistResponses
): { allowed: boolean; message?: string; missingLabels?: string[] } {
  const missingLabels: string[] = []

  for (const item of template) {
    if (!item.required) {
      continue
    }

    if (!isOperationalChecklistItemComplete(item, responses[item.id])) {
      missingLabels.push(item.title)
    }
  }

  if (missingLabels.length === 0) {
    return { allowed: true }
  }

  if (missingLabels.length === 1) {
    return {
      allowed: false,
      message: `Falta completar: ${missingLabels[0]}.`,
      missingLabels,
    }
  }

  return {
    allowed: false,
    message: `Faltan completar ${missingLabels.length} ítems del checklist.`,
    missingLabels,
  }
}

export function mergeChecklistWithResponses(
  template: MobileOperationalChecklistItem[],
  responses: OperationalChecklistResponses
): MobileTaskChecklistItem[] {
  return template.map((item) => {
    const response = responses[item.id]
    const completed = isOperationalChecklistItemComplete(item, response)

    return {
      id: item.id,
      label: item.title,
      fieldType: item.fieldType,
      required: item.required,
      sortOrder: item.sortOrder,
      confirmed: response?.confirmed ?? null,
      textValue: response?.textValue ?? null,
      photoIds: response?.photoIds ?? [],
      completed,
    }
  })
}

export async function fetchOperationalChecklistTemplate(
  client: SupabaseClient,
  companyId: string,
  serviceType: string | null | undefined
): Promise<MobileOperationalChecklistItem[]> {
  return fetchOperationalChecklistForServiceType(
    client,
    companyId,
    serviceType?.trim() || ""
  )
}

export function buildTaskMetadataWithResponses(
  task: Task,
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
