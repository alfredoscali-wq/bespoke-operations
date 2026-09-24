import {
  buildOperationalChecklistDisplayItems,
  readOperationalChecklistResponses,
  resolveOperationalChecklistResponseLabel,
} from "@/lib/tasks/operational-checklist-responses"
import { readOperationalChecklistTemplate } from "@/lib/tasks/operational-checklist-template"
import type { Task } from "@/lib/types/tasks"

import type { ProjectWorkReportChecklistItem } from "@/lib/projects/work-report/types"

/**
 * Checklist values are documentary. Unanswered items keep a null result.
 * Photography items do not invent a caption from the photo count.
 */
export function buildProjectWorkReportChecklistItems(
  task: Pick<Task, "taskMetadata">
): ProjectWorkReportChecklistItem[] | null {
  const template = readOperationalChecklistTemplate(task)
  if (template.length === 0) {
    return null
  }

  const responses = readOperationalChecklistResponses(task)
  const items = buildOperationalChecklistDisplayItems({
    template,
    responses,
    includeUnanswered: true,
  })

  return items.map((item) => {
    if (item.fieldType === "fotografia") {
      return {
        label: item.label,
        result: null,
        completed: item.hasResponse,
      }
    }

    return {
      label: item.label,
      result: resolveOperationalChecklistResponseLabel(item),
      completed: item.hasResponse,
    }
  })
}
