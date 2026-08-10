"use client"

import { createBrowserTasksClient } from "@/lib/supabase/tasks.browser"
import {
  fetchTaskDailyAllocationsByCompany,
  fetchTaskDailyAllocationsForTask,
  replaceTaskDailyAllocations,
} from "@/lib/supabase/task-daily-allocations.queries"
import type { TaskDailyAllocationDraft } from "@/lib/projects/task-daily-allocations"

export async function listCompanyTaskDailyAllocations(
  companyId: string
): Promise<Map<string, TaskDailyAllocationDraft[]>> {
  const client = createBrowserTasksClient()
  return fetchTaskDailyAllocationsByCompany(client, companyId)
}

export async function listTaskDailyAllocations(
  companyId: string,
  taskId: string
): Promise<TaskDailyAllocationDraft[]> {
  const client = createBrowserTasksClient()
  return fetchTaskDailyAllocationsForTask(client, companyId, taskId)
}

export async function syncTaskDailyAllocations(input: {
  companyId: string
  taskId: string
  allocations: readonly TaskDailyAllocationDraft[]
}): Promise<void> {
  const client = createBrowserTasksClient()
  await replaceTaskDailyAllocations(client, input)
}
