"use client"

import { useCallback } from "react"

import { useAuth } from "@/components/auth/auth-provider"
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
import { generateWorkOrderTaskCodeFromCodes } from "@/lib/tasks/work-order"
import {
  buildObraTaskCodePrefix,
  generateTaskCodeFromOccupied,
} from "@/lib/tasks/utils"
import { stripClientExecutionOrder } from "@/lib/tasks/execution-order-create"
import { recordTaskCreateAudit } from "@/lib/audit/tasks-audit"
import { startPerformanceTrace } from "@/lib/performance"
import { resolveOperationalEventActor } from "@/lib/tasks/operational-event-actor"
import { buildCreatedOperationalEvent } from "@/lib/tasks/operational-events"
import { recordTaskOperationalEvent } from "@/lib/supabase/operational-control.browser"
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
  const { sessionUser } = useAuth()

  const addTask = useCallback(
    async (input: CreateTaskPayload): Promise<Task> => {
      const perf = startPerformanceTrace("CREATE OT", { layer: "frontend" })
      try {
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
          throw new Error(
            "No fue posible crear la orden de trabajo. Intente nuevamente."
          )
        }

        const client = createBrowserTasksClient()

        if (payload.projectCode === "OT") {
          const occupiedCodesResult = await perf.span("List occupied codes", () =>
            listOccupiedTaskCodesByPrefix(companyId, "TSK-OT-", client)
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

        payload = await perf.span("Enrich location", () =>
          enrichCreateTaskPayloadWithResolvedLocation(payload)
        )

        payload = stripClientExecutionOrder(payload)

        if (payload.projectId && payload.projectCode?.trim()) {
          const prefix = buildObraTaskCodePrefix(payload.projectCode)
          const occupiedCodesResult = await perf.span(
            "List occupied obra codes",
            () => listOccupiedTaskCodesByPrefix(companyId, prefix, client)
          )
          const mergedCodes = new Set<string>([
            payload.code,
            ...tasks.map((task) => task.code),
            ...(occupiedCodesResult.data ?? []),
          ])
          payload = {
            ...payload,
            code: generateTaskCodeFromOccupied(payload.projectCode, mergedCodes),
          }
        }

        const result = await perf.span("Insert task", () =>
          createTask(payload, client)
        )

        if (!result.data) {
          logOperationError("TASK CREATE", {
            code: result.error?.code ?? "UNKNOWN",
            companyId,
            crewId: payload.crewId ?? null,
            dueDate: payload.dueDate ?? null,
            executionOrder: null,
          })
          throw new Error(
            result.error?.message?.trim() ||
              "No fue posible crear la orden de trabajo. Intente nuevamente."
          )
        }

        perf.spanSync("UI update", () => {
          cacheDetail(result.data!.id, getTaskDetail(result.data!))
          setTasks((current) => [result.data!, ...current])
        })
        recordTaskCreateAudit(result.data)

        if (companyId) {
          void recordTaskOperationalEvent(
            buildCreatedOperationalEvent({
              companyId,
              task: result.data,
              actor: resolveOperationalEventActor(sessionUser),
              description: result.data.code?.trim()
                ? `Código ${result.data.code.trim()}`
                : "",
            })
          )
        }

        perf.finish({
          companyId,
          crewId: result.data.crewId ?? null,
          dueDate: result.data.dueDate ?? null,
          executionOrder: result.data.executionOrder ?? null,
        })
        return result.data
      } catch (error) {
        perf.fail(error)
        throw error
      }
    },
    [
      tasks,
      usesSupabase,
      isReadOnly,
      openRestrictedDialog,
      companyId,
      setTasks,
      sessionUser,
    ]
  )

  return { addTask }
}
