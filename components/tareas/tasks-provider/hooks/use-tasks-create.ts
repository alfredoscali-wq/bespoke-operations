"use client"

import { useCallback } from "react"

import {
  blockDemoWrite,
  DemoWriteBlockedError,
} from "@/lib/demo/demo-write-block"
import {
  enrichCreateTaskPayloadWithResolvedLocation,
} from "@/lib/location/client/enrich-task-payload"
import { getTaskDetail } from "@/lib/data/tasks"
import {
  createBrowserTasksClient,
  createTask,
  listOccupiedTaskCodesByPrefix,
} from "@/lib/supabase/tasks.browser"
import { logOperationError } from "@/lib/operations/user-messages"
import { getInitialTaskStatus } from "@/lib/tasks/task-status-workflow"
import {
  generateWorkOrderTaskCodeFromCodes,
  isWorkOrderTask,
} from "@/lib/tasks/work-order"
import { resolveNextPlanningQueuePosition } from "@/lib/planificacion/planning-dynamic"
import { shouldApplyPlanningQueueSideEffectsForTask } from "@/lib/projects/project-start-dispatch"
import { recordTaskCreateAudit } from "@/lib/audit/tasks-audit"
import type { CreateTaskPayload } from "@/lib/types/supabase/tasks"
import type { Task } from "@/lib/types/tasks"

import { cacheDetail } from "../detail-cache"

type UseTasksCreateParams = {
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  usesSupabase: boolean
  companyId: string
  isReadOnly: boolean
  openRestrictedDialog: () => void
}

export function useTasksCreate({
  tasks,
  setTasks,
  usesSupabase,
  companyId,
  isReadOnly,
  openRestrictedDialog,
}: UseTasksCreateParams) {
  const addTask = useCallback(
    async (input: CreateTaskPayload): Promise<Task> => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        throw new DemoWriteBlockedError()
      }

      const status =
        input.status ??
        getInitialTaskStatus({ crewId: input.crewId, crew: input.crew })
      let payload: CreateTaskPayload = {
        ...input,
        companyId,
        status,
      }

      if (!usesSupabase) {
        throw new Error("No fue posible crear la orden de trabajo. Intente nuevamente.")
      }

      const client = createBrowserTasksClient()

      if (payload.projectCode === "OT") {
        const occupiedCodesResult = await listOccupiedTaskCodesByPrefix(
          companyId,
          "TSK-OT-",
          client
        )
        const mergedCodes = new Set<string>([
          ...tasks.map((task) => task.code),
          ...(occupiedCodesResult.data ?? []),
        ])

        payload = {
          ...payload,
          code: generateWorkOrderTaskCodeFromCodes(mergedCodes),
        }
      }

      payload = await enrichCreateTaskPayloadWithResolvedLocation(payload)

      const crewId = payload.crewId?.trim() || null
      const dueDate = payload.dueDate?.trim()
      if (
        shouldApplyPlanningQueueSideEffectsForTask(payload) &&
        isWorkOrderTask(payload as Task) &&
        crewId &&
        dueDate &&
        (payload.status === "programada" || payload.status == null)
      ) {
        payload = {
          ...payload,
          status: payload.status ?? "programada",
          executionOrder: resolveNextPlanningQueuePosition({
            tasks,
            dueDate,
            crewId,
          }),
        }
      }

      console.log("BEFORE INSERT", payload)

      const result = await createTask(payload, client)

      if (!result.data) {
        logOperationError("TASK CREATE", result.error)
        throw new Error("No fue posible crear la orden de trabajo. Intente nuevamente.")
      }

      cacheDetail(result.data.id, getTaskDetail(result.data))
      setTasks((current) => [result.data!, ...current])
      recordTaskCreateAudit(result.data)
      return result.data
    },
    [tasks, usesSupabase, isReadOnly, openRestrictedDialog, companyId, setTasks]
  )

  return { addTask }
}
