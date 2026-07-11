import "server-only"

import { fetchOperationalChecklistForServiceType } from "@/lib/mobile/v1/checklist/checklist-queries"
import type { MobileOperationalChecklistItem } from "@/lib/mobile/v1/checklist/types"
import type {
  MobileTaskChecklistItem,
  MobileTaskChecklistResponseValue,
} from "@/lib/mobile/v1/tasks/types"
import {
  buildTaskMetadataWithResponses,
  mergeChecklistResponseValue,
  OPERATIONAL_CHECKLIST_RESPONSES_KEY,
  operationalChecklistResponseHasValue,
  readOperationalChecklistResponses,
  type OperationalChecklistResponses,
} from "@/lib/tasks/operational-checklist-responses"
import {
  mapTemplateToMobileItems,
  readOperationalChecklistTemplate,
} from "@/lib/tasks/operational-checklist-template"
import type { Task } from "@/lib/types/tasks"
import type { SupabaseClient } from "@supabase/supabase-js"

export {
  OPERATIONAL_CHECKLIST_RESPONSES_KEY,
  type OperationalChecklistResponses,
  readOperationalChecklistResponses,
  buildTaskMetadataWithResponses,
  mergeChecklistResponseValue,
} from "@/lib/tasks/operational-checklist-responses"

export function isOperationalChecklistItemComplete(
  item: MobileOperationalChecklistItem,
  response: MobileTaskChecklistResponseValue | undefined
): boolean {
  return operationalChecklistResponseHasValue(item.fieldType, response)
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

export async function fetchOperationalChecklistTemplateForTask(
  client: SupabaseClient,
  companyId: string,
  task: Pick<Task, "projectId" | "serviceType" | "taskMetadata">
): Promise<MobileOperationalChecklistItem[]> {
  if (task.projectId) {
    const embedded = readOperationalChecklistTemplate(task)
    if (embedded.length > 0) {
      return mapTemplateToMobileItems(embedded)
    }
    return []
  }

  return fetchOperationalChecklistTemplate(client, companyId, task.serviceType)
}
