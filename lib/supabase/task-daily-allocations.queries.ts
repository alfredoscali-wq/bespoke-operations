import type { TaskDailyAllocationDraft } from "@/lib/projects/task-daily-allocations"

// OPS 2.6: table not yet in generated Database types — use untyped client access.
type AllocationsClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (relation: string) => any
}

function mapRowToDraft(row: {
  work_date: string
  allocated_minutes: number
}): TaskDailyAllocationDraft {
  return {
    workDate: row.work_date,
    allocatedMinutes: row.allocated_minutes,
  }
}

export async function fetchTaskDailyAllocationsByCompany(
  client: AllocationsClient,
  companyId: string
): Promise<Map<string, TaskDailyAllocationDraft[]>> {
  const { data, error } = await client
    .from("task_daily_allocations")
    .select("task_id, work_date, allocated_minutes")
    .eq("company_id", companyId)
    .order("work_date", { ascending: true })

  if (error) {
    throw error
  }

  const map = new Map<string, TaskDailyAllocationDraft[]>()
  for (const row of data ?? []) {
    const taskId = String(row.task_id)
    const draft = mapRowToDraft(row)
    const list = map.get(taskId) ?? []
    list.push(draft)
    map.set(taskId, list)
  }
  return map
}

export async function fetchTaskDailyAllocationsForTask(
  client: AllocationsClient,
  companyId: string,
  taskId: string
): Promise<TaskDailyAllocationDraft[]> {
  const { data, error } = await client
    .from("task_daily_allocations")
    .select("work_date, allocated_minutes")
    .eq("company_id", companyId)
    .eq("task_id", taskId)
    .order("work_date", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map(mapRowToDraft)
}

/**
 * Replace all allocations for a task.
 * Empty array → delete all (automatic / legacy mode).
 */
export async function replaceTaskDailyAllocations(
  client: AllocationsClient,
  input: {
    companyId: string
    taskId: string
    allocations: readonly TaskDailyAllocationDraft[]
  }
): Promise<void> {
  const { companyId, taskId, allocations } = input

  const { error: deleteError } = await client
    .from("task_daily_allocations")
    .delete()
    .eq("company_id", companyId)
    .eq("task_id", taskId)

  if (deleteError) {
    throw deleteError
  }

  if (allocations.length === 0) {
    return
  }

  const rows = allocations.map((row) => ({
    company_id: companyId,
    task_id: taskId,
    work_date: row.workDate,
    allocated_minutes: row.allocatedMinutes,
  }))

  const { error: insertError } = await client
    .from("task_daily_allocations")
    .insert(rows)

  if (insertError) {
    throw insertError
  }
}
