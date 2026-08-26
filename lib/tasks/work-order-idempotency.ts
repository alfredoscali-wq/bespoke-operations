import type { Json } from "@/lib/supabase/database.types"
import type { CreateTaskPayload } from "@/lib/types/supabase/tasks"
import type { Task } from "@/lib/types/tasks"

export const WORK_ORDER_IDEMPOTENCY_PAYLOAD_CONFLICT_CODE =
  "IDEMPOTENCY_PAYLOAD_CONFLICT" as const
export const WORK_ORDER_IDEMPOTENCY_OPERATION_DELETED_CODE =
  "IDEMPOTENCY_OPERATION_DELETED" as const
export const WORK_ORDER_IDEMPOTENCY_KEY_INVALID_CODE =
  "IDEMPOTENCY_KEY_INVALID" as const

export const WORK_ORDER_IDEMPOTENCY_OPERATION_DELETED_MESSAGE =
  "Esta operación ya creó una orden de trabajo que fue eliminada. Cancelá y abrí una nueva OT para generar otra."
export const WORK_ORDER_IDEMPOTENCY_PAYLOAD_CONFLICT_MESSAGE =
  "Esta operación ya creó una OT con otros datos. Cancelá y abrí una nueva OT."
export const WORK_ORDER_IDEMPOTENCY_KEY_INVALID_MESSAGE =
  "La clave de operación no es válida."

export type CreateWorkOrderIdempotentResult = {
  task: Task
  taskId: string
  created: boolean
  idempotentReplay: boolean
}

export type WorkOrderIdempotentRpcResponse = {
  task: Record<string, unknown>
  created: boolean
  idempotentReplay: boolean
  taskId: string
}

export function createWorkOrderIdempotencyKey(
  randomUUID: () => string = () => crypto.randomUUID()
): string {
  return randomUUID()
}

export function shouldRotateWorkOrderIdempotencyKey(input: {
  dialogOpen: boolean
  isEditMode: boolean
  previousOpen: boolean
}): boolean {
  return input.dialogOpen && !input.isEditMode && !input.previousOpen
}

export function syncCreateCustomerDraftLocation(
  payload: CreateTaskPayload
): CreateTaskPayload {
  if (!payload.createCustomerDraft) {
    return payload
  }

  return {
    ...payload,
    createCustomerDraft: {
      ...payload.createCustomerDraft,
      latitude: payload.latitude ?? payload.createCustomerDraft.latitude,
      longitude: payload.longitude ?? payload.createCustomerDraft.longitude,
      sharedLocation:
        payload.sharedLocation ?? payload.createCustomerDraft.sharedLocation,
    },
  }
}

export function buildCreateWorkOrderIdempotentRpcPayload(
  mappedInsert: Record<string, unknown>,
  payload: CreateTaskPayload
): Json {
  const body: Record<string, unknown> = {
    ...mappedInsert,
    idempotency_key: payload.idempotencyKey,
  }

  if (payload.createCustomerDraft) {
    const draft = payload.createCustomerDraft
    body.create_customer = {
      name: draft.name,
      dni: draft.dni ?? null,
      phone: draft.phone ?? null,
      email: draft.email ?? null,
      address: draft.address ?? null,
      locality: draft.locality ?? null,
      technology: draft.technology ?? null,
      contracted_plan: draft.contractedPlan ?? null,
      latitude: draft.latitude ?? null,
      longitude: draft.longitude ?? null,
      shared_location: draft.sharedLocation ?? null,
    }
  }

  if (payload.atencionId?.trim()) {
    body.atencion_id = payload.atencionId.trim()
  }

  if (payload.commercialSolicitudId?.trim()) {
    body.commercial_solicitud_id = payload.commercialSolicitudId.trim()
  }

  return body as Json
}

export function parseCreateWorkOrderIdempotentResponse(
  data: unknown
): WorkOrderIdempotentRpcResponse | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null
  }

  const row = data as Record<string, unknown>
  const nestedTask = row.task
  if (nestedTask && typeof nestedTask === "object" && !Array.isArray(nestedTask)) {
    const task = nestedTask as Record<string, unknown>
    const taskId = typeof task.id === "string" ? task.id : ""
    if (!taskId) {
      return null
    }

    return {
      task,
      taskId,
      created: row.created === true,
      idempotentReplay:
        row.idempotent_replay === true || row.idempotentReplay === true,
    }
  }

  if (typeof row.id === "string" && row.id.trim()) {
    return {
      task: row,
      taskId: row.id,
      created: true,
      idempotentReplay: false,
    }
  }

  return null
}

export function toCreateWorkOrderIdempotentResult(
  task: Task,
  flags: { created: boolean; idempotentReplay: boolean }
): CreateWorkOrderIdempotentResult {
  return {
    task,
    taskId: task.id,
    created: flags.created,
    idempotentReplay: flags.idempotentReplay,
  }
}

export type SimulatedWorkOrderRecord = {
  id: string
  companyId: string
  idempotencyKey: string
  customerId: string | null
  deleted: boolean
}

export type SimulatedIdempotentCreateInput = {
  companyId: string
  idempotencyKey: string
  customerId?: string | null
  createCustomer?: boolean
  atencionId?: string | null
  commercialSolicitudId?: string | null
  failTaskCreate?: boolean
}

export type SimulatedIdempotentCreateResult = {
  taskId: string
  customerId: string | null
  created: boolean
  idempotentReplay: boolean
  atencionLinkedTaskId: string | null
  commercialLinkedTaskId: string | null
  atencionLinkCount: number
}

/**
 * In-memory model of create_work_order_idempotent: serialize per
 * company + key, reuse the existing OT, and roll back a new customer
 * if the OT insert fails in the same operation.
 */
export function createIdempotentWorkOrderOperationStore() {
  const tasks: SimulatedWorkOrderRecord[] = []
  const customers: { id: string; companyId: string }[] = []
  const atencionLinks = new Map<string, { taskId: string; count: number }>()
  const commercialLinks = new Map<string, string>()
  const tails = new Map<string, Promise<void>>()
  let nextTask = 1
  let nextCustomer = 1

  function lockKey(companyId: string, key: string) {
    return `${companyId}:${key}`
  }

  function findTask(companyId: string, key: string) {
    return tasks.find(
      (task) => task.companyId === companyId && task.idempotencyKey === key
    )
  }

  async function create(
    input: SimulatedIdempotentCreateInput
  ): Promise<SimulatedIdempotentCreateResult> {
    const key = lockKey(input.companyId, input.idempotencyKey)
    const previous = tails.get(key) ?? Promise.resolve()
    let result: SimulatedIdempotentCreateResult | null = null

    const run = previous.then(() => {
      const existing = findTask(input.companyId, input.idempotencyKey)
      if (existing) {
        if (existing.deleted) {
          throw new Error(WORK_ORDER_IDEMPOTENCY_OPERATION_DELETED_CODE)
        }
        if (
          input.customerId &&
          existing.customerId &&
          input.customerId !== existing.customerId
        ) {
          throw new Error(WORK_ORDER_IDEMPOTENCY_PAYLOAD_CONFLICT_CODE)
        }

        const atencion = input.atencionId
          ? atencionLinks.get(input.atencionId)
          : undefined
        const commercial = input.commercialSolicitudId
          ? commercialLinks.get(input.commercialSolicitudId)
          : undefined

        result = {
          taskId: existing.id,
          customerId: existing.customerId,
          created: false,
          idempotentReplay: true,
          atencionLinkedTaskId: atencion?.taskId ?? null,
          commercialLinkedTaskId: commercial ?? null,
          atencionLinkCount: atencion?.count ?? 0,
        }
        return
      }

      let customerId = input.customerId?.trim() || null
      let createdCustomerId: string | null = null

      if (!customerId && input.createCustomer) {
        createdCustomerId = `cust-${nextCustomer++}`
        customers.push({ id: createdCustomerId, companyId: input.companyId })
        customerId = createdCustomerId
      }

      if (input.failTaskCreate) {
        if (createdCustomerId) {
          const index = customers.findIndex((row) => row.id === createdCustomerId)
          if (index >= 0) {
            customers.splice(index, 1)
          }
        }
        throw new Error("TASK_CREATE_FAILED")
      }

      const taskId = `task-${nextTask++}`
      tasks.push({
        id: taskId,
        companyId: input.companyId,
        idempotencyKey: input.idempotencyKey,
        customerId,
        deleted: false,
      })

      if (input.atencionId) {
        const previousLink = atencionLinks.get(input.atencionId)
        if (previousLink && previousLink.taskId !== taskId) {
          throw new Error(WORK_ORDER_IDEMPOTENCY_PAYLOAD_CONFLICT_CODE)
        }
        atencionLinks.set(input.atencionId, {
          taskId,
          count: (previousLink?.count ?? 0) + 1,
        })
      }

      if (input.commercialSolicitudId) {
        const previousLink = commercialLinks.get(input.commercialSolicitudId)
        if (previousLink && previousLink !== taskId) {
          throw new Error(WORK_ORDER_IDEMPOTENCY_PAYLOAD_CONFLICT_CODE)
        }
        commercialLinks.set(input.commercialSolicitudId, taskId)
      }

      const atencion = input.atencionId
        ? atencionLinks.get(input.atencionId)
        : undefined
      const commercial = input.commercialSolicitudId
        ? commercialLinks.get(input.commercialSolicitudId)
        : undefined

      result = {
        taskId,
        customerId,
        created: true,
        idempotentReplay: false,
        atencionLinkedTaskId: atencion?.taskId ?? null,
        commercialLinkedTaskId: commercial ?? null,
        atencionLinkCount: atencion?.count ?? 0,
      }
    })

    tails.set(
      key,
      run.then(
        () => undefined,
        () => undefined
      )
    )

    await run
    if (!result) {
      throw new Error("IDEMPOTENT_CREATE_UNREACHABLE")
    }
    return result
  }

  return {
    create,
    listTasks: () => tasks.slice(),
    listCustomers: () => customers.slice(),
    softDelete(taskId: string) {
      const task = tasks.find((row) => row.id === taskId)
      if (task) {
        task.deleted = true
      }
    },
  }
}
