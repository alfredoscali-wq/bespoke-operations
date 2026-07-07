import "server-only"

import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
  buildAuditDescription,
  writeAuditLog,
} from "@/lib/audit"
import type { SessionUser } from "@/lib/auth/types"
import type { SupabaseAdminClient } from "@/lib/supabase/admin"
import { EVIDENCES_STORAGE_BUCKET } from "@/lib/supabase/evidences.storage"
import { TASK_PHOTOS_STORAGE_BUCKET } from "@/lib/supabase/task-photos.storage"
import {
  assertCustomerPermanentDeleteAllowed,
  assertPermanentDeleteEntityImplemented,
  assertTaskPermanentDeleteAllowed,
  PERMANENT_DELETE_NOT_IMPLEMENTED_MESSAGE,
} from "@/lib/admin/permanent-delete-policy"
import { collectTaskIncidentPhotoStoragePaths } from "@/lib/admin/permanent-delete-task-records-plan"
import type { PermanentDeleteEntityType } from "@/lib/admin/permanent-delete-types"
import { TASK_INCIDENT_PHOTOS_STORAGE_BUCKET } from "@/lib/supabase/task-incident-photos.storage"

export type { PermanentDeleteEntityType } from "@/lib/admin/permanent-delete-types"

export type PermanentDeleteResult = {
  success: true
  entityType: PermanentDeleteEntityType
  entityId: string
  entityLabel: string
  deletedTasks: number
}

type StorageBackedRow = {
  storage_bucket: string | null
  storage_path: string | null
}

async function removeStorageObjects(
  client: SupabaseAdminClient,
  rows: StorageBackedRow[]
) {
  const byBucket = new Map<string, Set<string>>()

  for (const row of rows) {
    const path = row.storage_path?.trim()
    if (!path) continue

    const bucket = row.storage_bucket?.trim() || EVIDENCES_STORAGE_BUCKET
    const paths = byBucket.get(bucket) ?? new Set<string>()
    paths.add(path)
    byBucket.set(bucket, paths)
  }

  for (const [bucket, paths] of byBucket.entries()) {
    const pathList = [...paths]
    if (pathList.length === 0) continue

    const { error } = await client.storage.from(bucket).remove(pathList)
    if (error) {
      console.error("[PERMANENT_DELETE_STORAGE]", { bucket, error })
    }
  }
}

async function permanentDeleteTaskIncidents(
  client: SupabaseAdminClient,
  taskId: string
) {
  const { data: incidents, error: incidentsReadError } = await client
    .from("task_incidents")
    .select("id")
    .eq("task_id", taskId)

  if (incidentsReadError) {
    throw new Error(
      `No se pudieron leer incidencias de la orden de trabajo: ${incidentsReadError.message}`
    )
  }

  const incidentIds = (incidents ?? []).map((row) => row.id)

  if (incidentIds.length === 0) {
    return
  }

  const { data: incidentPhotos, error: incidentPhotosReadError } = await client
    .from("task_incident_photos")
    .select("storage_path, thumbnail_path")
    .in("incident_id", incidentIds)

  if (incidentPhotosReadError) {
    throw new Error(
      `No se pudieron leer fotografías de incidencias: ${incidentPhotosReadError.message}`
    )
  }

  const storagePaths = collectTaskIncidentPhotoStoragePaths(incidentPhotos ?? [])

  if (storagePaths.length > 0) {
    await removeStorageObjects(
      client,
      storagePaths.map((storage_path) => ({
        storage_bucket: TASK_INCIDENT_PHOTOS_STORAGE_BUCKET,
        storage_path,
      }))
    )
  }

  const { error: incidentsDeleteError } = await client
    .from("task_incidents")
    .delete()
    .eq("task_id", taskId)

  if (incidentsDeleteError) {
    throw new Error(
      `No se pudieron eliminar incidencias: ${incidentsDeleteError.message}`
    )
  }
}

async function permanentDeleteTaskRecords(
  client: SupabaseAdminClient,
  taskId: string
) {
  await permanentDeleteTaskIncidents(client, taskId)

  const { data: evidences, error: evidencesReadError } = await client
    .from("evidences")
    .select("storage_bucket, storage_path")
    .eq("task_id", taskId)

  if (evidencesReadError) {
    throw new Error(
      `No se pudieron leer evidencias de la orden de trabajo: ${evidencesReadError.message}`
    )
  }

  await removeStorageObjects(client, evidences ?? [])

  const { data: photos, error: photosReadError } = await client
    .from("task_photos")
    .select("storage_bucket, storage_path")
    .eq("task_id", taskId)

  if (photosReadError) {
    throw new Error(
      `No se pudieron leer fotografías de la orden de trabajo: ${photosReadError.message}`
    )
  }

  await removeStorageObjects(
    client,
    (photos ?? []).map((row) => ({
      storage_bucket: row.storage_bucket ?? TASK_PHOTOS_STORAGE_BUCKET,
      storage_path: row.storage_path,
    }))
  )

  const { error: evidencesDeleteError } = await client
    .from("evidences")
    .delete()
    .eq("task_id", taskId)

  if (evidencesDeleteError) {
    throw new Error(
      `No se pudieron eliminar evidencias: ${evidencesDeleteError.message}`
    )
  }

  const { error: photosDeleteError } = await client
    .from("task_photos")
    .delete()
    .eq("task_id", taskId)

  if (photosDeleteError) {
    throw new Error(
      `No se pudieron eliminar fotografías: ${photosDeleteError.message}`
    )
  }

  const { error: taskDeleteError } = await client
    .from("tasks")
    .delete()
    .eq("id", taskId)

  if (taskDeleteError) {
    throw new Error(
      `No se pudo eliminar la orden de trabajo: ${taskDeleteError.message}`
    )
  }
}

export async function permanentDeleteTask(
  client: SupabaseAdminClient,
  input: {
    taskId: string
    sessionUser: SessionUser
  }
): Promise<PermanentDeleteResult> {
  const { data: task, error: taskReadError } = await client
    .from("tasks")
    .select("id, code, title, customer_id")
    .eq("id", input.taskId)
    .maybeSingle()

  if (taskReadError) {
    throw new Error(`No se pudo leer la orden de trabajo: ${taskReadError.message}`)
  }

  if (!task) {
    throw new Error("Orden de trabajo no encontrada.")
  }

  await assertTaskPermanentDeleteAllowed(client, input.taskId)

  const entityLabel = task.code?.trim() || task.title?.trim() || input.taskId
  const administratorName = input.sessionUser.displayName?.trim() || "Administrador"

  await permanentDeleteTaskRecords(client, input.taskId)

  await writeAuditLog(client, {
    action: AUDIT_ACTIONS.TASK_DELETE_PERMANENT,
    module: AUDIT_MODULES.TAREAS,
    entityType: AUDIT_ENTITY_TYPES.TASK,
    entityId: input.taskId,
    entityLabel,
    description: `Administrador ${administratorName} eliminó definitivamente la OT ${entityLabel}.`,
    performedBy: { kind: "user", sessionUser: input.sessionUser },
    metadata: {
      code: task.code,
      title: task.title,
      customerId: task.customer_id,
    },
  })
  return {
    success: true,
    entityType: "task",
    entityId: input.taskId,
    entityLabel,
    deletedTasks: 1,
  }
}

export async function permanentDeleteCustomer(
  client: SupabaseAdminClient,
  input: {
    customerId: string
    sessionUser: SessionUser
  }
): Promise<PermanentDeleteResult> {
  const { data: customer, error: customerReadError } = await client
    .from("customers")
    .select("id, name, customer_number, external_customer_code")
    .eq("id", input.customerId)
    .maybeSingle()

  if (customerReadError) {
    throw new Error(`No se pudo leer el cliente: ${customerReadError.message}`)
  }

  if (!customer) {
    throw new Error("Cliente no encontrado.")
  }

  await assertCustomerPermanentDeleteAllowed(client, input.customerId)

  const entityLabel =
    customer.name?.trim() ||
    customer.external_customer_code?.trim() ||
    customer.customer_number?.trim() ||
    input.customerId

  const { data: tasks, error: tasksReadError } = await client
    .from("tasks")
    .select("id")
    .eq("customer_id", input.customerId)

  if (tasksReadError) {
    throw new Error(
      `No se pudieron leer órdenes de trabajo del cliente: ${tasksReadError.message}`
    )
  }

  for (const task of tasks ?? []) {
    await permanentDeleteTaskRecords(client, task.id)
  }

  const { error: customerDeleteError } = await client
    .from("customers")
    .delete()
    .eq("id", input.customerId)

  if (customerDeleteError) {
    throw new Error(`No se pudo eliminar el cliente: ${customerDeleteError.message}`)
  }

  await writeAuditLog(client, {
    action: AUDIT_ACTIONS.CUSTOMER_DELETE_PERMANENT,
    module: AUDIT_MODULES.CLIENTES,
    entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
    entityId: input.customerId,
    entityLabel,
    description: buildAuditDescription({
      action: AUDIT_ACTIONS.CUSTOMER_DELETE_PERMANENT,
      entityLabel,
    }),
    performedBy: { kind: "user", sessionUser: input.sessionUser },
    metadata: {
      customerNumber: customer.customer_number,
      externalCustomerCode: customer.external_customer_code,
      deletedTaskCount: tasks?.length ?? 0,
    },
  })
  return {
    success: true,
    entityType: "customer",
    entityId: input.customerId,
    entityLabel,
    deletedTasks: tasks?.length ?? 0,
  }
}

export async function executePermanentDelete(
  client: SupabaseAdminClient,
  input: {
    entityType: PermanentDeleteEntityType
    entityId: string
    sessionUser: SessionUser
  }
): Promise<PermanentDeleteResult> {
  assertPermanentDeleteEntityImplemented(input.entityType)

  if (input.entityType === "customer") {
    return permanentDeleteCustomer(client, {
      customerId: input.entityId,
      sessionUser: input.sessionUser,
    })
  }

  if (input.entityType === "task") {
    return permanentDeleteTask(client, {
      taskId: input.entityId,
      sessionUser: input.sessionUser,
    })
  }

  throw new Error(PERMANENT_DELETE_NOT_IMPLEMENTED_MESSAGE)
}
