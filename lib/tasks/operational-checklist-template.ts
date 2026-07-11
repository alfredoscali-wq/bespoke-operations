import type { MobileOperationalChecklistItem } from "@/lib/mobile/v1/checklist/types"
import type { WorkOrderTypeChecklistItem } from "@/lib/types/work-order-type-checklist"
import type { Task } from "@/lib/types/tasks"
import {
  DEFAULT_CHECKLIST_FIELD_TYPE,
  isChecklistFieldType,
  type ChecklistFieldType,
} from "@/lib/work-order-types/checklist-field-types"

export const OPERATIONAL_CHECKLIST_TEMPLATE_KEY = "operationalChecklistTemplate"

export type OperationalChecklistTemplateItem = {
  id: string
  title: string
  fieldType: ChecklistFieldType
  required: boolean
  sortOrder: number
}

export type OperationalChecklistTemplateLike = Pick<
  WorkOrderTypeChecklistItem,
  "id" | "title" | "fieldType" | "required" | "sortOrder"
>

function parseTemplateItem(value: unknown): OperationalChecklistTemplateItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const id = typeof record.id === "string" ? record.id.trim() : ""
  const title = typeof record.title === "string" ? record.title.trim() : ""
  const fieldType = isChecklistFieldType(record.fieldType as string)
    ? (record.fieldType as ChecklistFieldType)
    : DEFAULT_CHECKLIST_FIELD_TYPE
  const required = record.required === true
  const sortOrder =
    typeof record.sortOrder === "number" && record.sortOrder > 0
      ? Math.trunc(record.sortOrder)
      : null

  if (!id || !title || sortOrder == null) {
    return null
  }

  return {
    id,
    title,
    fieldType,
    required,
    sortOrder,
  }
}

export function readOperationalChecklistTemplate(
  task: Pick<Task, "taskMetadata">
): OperationalChecklistTemplateItem[] {
  const raw = task.taskMetadata?.[OPERATIONAL_CHECKLIST_TEMPLATE_KEY]

  if (!Array.isArray(raw)) {
    return []
  }

  return normalizeOperationalChecklistTemplate(
    raw
      .map((item) => parseTemplateItem(item))
      .filter((item): item is OperationalChecklistTemplateItem => item !== null)
  )
}

export function normalizeOperationalChecklistTemplate(
  items: OperationalChecklistTemplateItem[]
): OperationalChecklistTemplateItem[] {
  return [...items]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item, index) => ({
      ...item,
      title: item.title.trim(),
      sortOrder: index + 1,
    }))
    .filter((item) => item.title.length > 0)
}

export function createOperationalChecklistTemplateItem(
  sortOrder: number
): OperationalChecklistTemplateItem {
  return {
    id: crypto.randomUUID(),
    title: "",
    fieldType: DEFAULT_CHECKLIST_FIELD_TYPE,
    required: false,
    sortOrder,
  }
}

export function reorderOperationalChecklistTemplateItems(
  items: OperationalChecklistTemplateItem[],
  draggedId: string,
  targetId: string
): OperationalChecklistTemplateItem[] {
  if (draggedId === targetId) {
    return items
  }

  const ordered = normalizeOperationalChecklistTemplate(items)
  const fromIndex = ordered.findIndex((item) => item.id === draggedId)
  const toIndex = ordered.findIndex((item) => item.id === targetId)

  if (fromIndex < 0 || toIndex < 0) {
    return ordered
  }

  const [moved] = ordered.splice(fromIndex, 1)
  ordered.splice(toIndex, 0, moved)

  return normalizeOperationalChecklistTemplate(ordered)
}

export function mergeTaskMetadataWithTemplate(
  task: Pick<Task, "taskMetadata">,
  template: OperationalChecklistTemplateItem[]
): Record<string, unknown> {
  const normalized = normalizeOperationalChecklistTemplate(template)
  const next: Record<string, unknown> = {
    ...(task.taskMetadata ?? {}),
  }

  if (normalized.length === 0) {
    delete next[OPERATIONAL_CHECKLIST_TEMPLATE_KEY]
    return next
  }

  next[OPERATIONAL_CHECKLIST_TEMPLATE_KEY] = normalized
  return next
}

export function mapTemplateToMobileItems(
  template: OperationalChecklistTemplateLike[]
): MobileOperationalChecklistItem[] {
  return [...template]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item) => ({
      id: item.id,
      title: item.title,
      fieldType: item.fieldType,
      required: item.required,
      sortOrder: item.sortOrder,
    }))
}

export function taskHasEmbeddedOperationalChecklistTemplate(
  task: Pick<Task, "projectId" | "taskMetadata">
): boolean {
  return Boolean(task.projectId) && readOperationalChecklistTemplate(task).length > 0
}

export function shouldShowOperationalChecklistForTask(
  task: Pick<Task, "projectId" | "serviceType" | "taskMetadata">
): boolean {
  if (taskHasEmbeddedOperationalChecklistTemplate(task)) {
    return true
  }

  if (task.projectId) {
    return false
  }

  return Boolean(task.serviceType?.trim())
}

export function toWorkOrderTypeChecklistItemShape(
  item: OperationalChecklistTemplateItem,
  companyId = ""
): WorkOrderTypeChecklistItem {
  return {
    id: item.id,
    companyId,
    serviceType: "obra-task",
    title: item.title,
    fieldType: item.fieldType,
    required: item.required,
    sortOrder: item.sortOrder,
  }
}
