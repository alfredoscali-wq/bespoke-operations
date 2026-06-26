import { recordWorkOrderApprovalCustomerEffectsAudit } from "@/lib/audit/work-order-approval-audit"
import { parseCambioDomicilioFromTask } from "@/lib/tasks/cambio-domicilio"
import { resolveContractedPlanFromTask } from "@/lib/tasks/commercial-plan"
import {
  isFtthTechnology,
  resolveFinalTechnologyFromTask,
  resolveFtthInstallationFromTask,
  taskRequiresFtthInstallation,
} from "@/lib/tasks/ftth-installation"
import type { WorkOrderServiceType } from "@/lib/tasks/work-order"
import {
  getCustomerById,
  updateCustomer,
} from "@/lib/supabase/customers.browser"
import type { Customer, UpdateCustomerInput } from "@/lib/types/customers"
import type { Task } from "@/lib/types/tasks"
import { hasCoordinates } from "@/lib/gps"

export type WorkOrderApprovalEffectResult = {
  applied: boolean
  customerId?: string
  update?: UpdateCustomerInput
  message?: string
}

const APPROVAL_EFFECT_SERVICE_TYPES = new Set<WorkOrderServiceType>([
  "instalacion-nueva",
  "cambio-domicilio",
  "cambio-tecnologia",
  "baja",
  "reconexion",
])

function isApprovalEffectServiceType(
  serviceType: string | null | undefined
): serviceType is WorkOrderServiceType {
  return Boolean(
    serviceType &&
      APPROVAL_EFFECT_SERVICE_TYPES.has(serviceType as WorkOrderServiceType)
  )
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

type CustomerStringEffectField =
  | "technology"
  | "address"
  | "locality"
  | "contractedPlan"
  | "sharedLocation"
  | "napBox"
  | "napPort"
  | "onuSerial"
  | "statusReason"

function assignStringField(
  update: UpdateCustomerInput,
  key: CustomerStringEffectField,
  next: string | null | undefined,
  current: string | null | undefined
) {
  const normalizedNext = next?.trim() ?? ""
  const normalizedCurrent = current?.trim() ?? ""

  if (!normalizedNext || normalizedNext === normalizedCurrent) {
    return
  }

  update[key] = normalizedNext
}

function assignStatus(
  update: UpdateCustomerInput,
  next: string,
  current: string
) {
  if (next.trim().toLowerCase() !== current.trim().toLowerCase()) {
    update.status = next
  }
}

function assignCoordinates(
  update: UpdateCustomerInput,
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  customer: Customer
) {
  if (!hasCoordinates(latitude, longitude)) {
    return
  }

  if (customer.latitude !== latitude || customer.longitude !== longitude) {
    update.latitude = latitude ?? undefined
    update.longitude = longitude ?? undefined
  }
}

function applyFtthFields(
  update: UpdateCustomerInput,
  task: Task,
  customer: Customer
) {
  if (!taskRequiresFtthInstallation(task)) {
    return
  }

  const ftth = resolveFtthInstallationFromTask(task)

  assignStringField(update, "napBox", ftth.napBox, customer.napBox)
  assignStringField(update, "napPort", ftth.napPort, customer.napPort)
  assignStringField(update, "onuSerial", ftth.onuSerial, customer.onuSerial)
}

function buildInstalacionNuevaUpdate(
  task: Task,
  customer: Customer
): UpdateCustomerInput {
  const update: UpdateCustomerInput = {}
  const technology = resolveFinalTechnologyFromTask(task)

  if (technology) {
    assignStringField(update, "technology", technology, customer.technology)
  }

  assignStringField(
    update,
    "address",
    task.serviceAddress,
    customer.address
  )
  assignStringField(update, "locality", task.locality, customer.locality)

  const plan = resolveContractedPlanFromTask(task)
  if (plan) {
    assignStringField(update, "contractedPlan", plan, customer.contractedPlan)
  }

  assignStatus(update, "activo", customer.status)
  applyFtthFields(update, task, customer)

  return update
}

function buildCambioDomicilioUpdate(
  task: Task,
  customer: Customer
): UpdateCustomerInput {
  const update: UpdateCustomerInput = {}
  const cambio = parseCambioDomicilioFromTask(task)

  assignStringField(
    update,
    "address",
    cambio.new.address,
    customer.address
  )
  assignStringField(
    update,
    "locality",
    cambio.new.locality,
    customer.locality
  )

  assignCoordinates(
    update,
    cambio.new.latitude,
    cambio.new.longitude,
    customer
  )

  assignStringField(
    update,
    "sharedLocation",
    cambio.new.sharedLocation,
    customer.sharedLocation
  )

  return update
}

function buildCambioTecnologiaUpdate(
  task: Task,
  customer: Customer
): UpdateCustomerInput {
  const update: UpdateCustomerInput = {}
  const technology = resolveFinalTechnologyFromTask(task)

  if (technology) {
    assignStringField(update, "technology", technology, customer.technology)
  }

  const plan = resolveContractedPlanFromTask(task)
  if (plan) {
    assignStringField(update, "contractedPlan", plan, customer.contractedPlan)
  }

  applyFtthFields(update, task, customer)

  if (!isFtthTechnology(technology)) {
    if (customer.napBox || customer.napPort || customer.onuSerial) {
      update.napBox = null
      update.napPort = null
      update.onuSerial = null
    }
  }

  return update
}

function buildBajaUpdate(task: Task, customer: Customer): UpdateCustomerInput {
  const update: UpdateCustomerInput = {}
  const metadata = task.taskMetadata ?? {}
  const reason =
    readString(metadata.cancellationReason) ||
    readString(task.cancellationReason)

  assignStatus(update, "inactivo", customer.status)

  if (reason) {
    assignStringField(update, "statusReason", reason, customer.statusReason)
  }

  return update
}

function buildReconexionUpdate(
  _task: Task,
  customer: Customer
): UpdateCustomerInput {
  const update: UpdateCustomerInput = {}

  assignStatus(update, "activo", customer.status)

  if (customer.statusReason?.trim()) {
    update.statusReason = null
  }

  return update
}

export function buildCustomerUpdateFromApprovedTask(
  task: Task,
  customer: Customer
): UpdateCustomerInput | null {
  if (!isApprovalEffectServiceType(task.serviceType)) {
    return null
  }

  switch (task.serviceType) {
    case "instalacion-nueva":
      return buildInstalacionNuevaUpdate(task, customer)
    case "cambio-domicilio":
      return buildCambioDomicilioUpdate(task, customer)
    case "cambio-tecnologia":
      return buildCambioTecnologiaUpdate(task, customer)
    case "baja":
      return buildBajaUpdate(task, customer)
    case "reconexion":
      return buildReconexionUpdate(task, customer)
    default:
      return null
  }
}

function hasCustomerUpdateFields(update: UpdateCustomerInput): boolean {
  return Object.keys(update).length > 0
}

export async function applyWorkOrderApprovalEffects(
  task: Task
): Promise<WorkOrderApprovalEffectResult> {
  if (!task.customerId?.trim()) {
    return {
      applied: false,
      message: "La orden de trabajo no tiene cliente vinculado.",
    }
  }

  if (!isApprovalEffectServiceType(task.serviceType)) {
    return { applied: false }
  }

  const customerResult = await getCustomerById(task.customerId)
  if (!customerResult.data) {
    return {
      applied: false,
      message: "No se encontró el cliente vinculado a la orden de trabajo.",
    }
  }

  const customer = customerResult.data
  const update = buildCustomerUpdateFromApprovedTask(task, customer)

  if (!update || !hasCustomerUpdateFields(update)) {
    return { applied: false }
  }

  const result = await updateCustomer(task.customerId, update)

  if (!result.data) {
    return {
      applied: false,
      message: "No fue posible actualizar la ficha del cliente.",
    }
  }

  recordWorkOrderApprovalCustomerEffectsAudit(customer, update, task)

  return {
    applied: true,
    customerId: task.customerId,
    update,
  }
}

export function taskHasApprovalCustomerEffects(
  task: Pick<Task, "serviceType">
): boolean {
  return isApprovalEffectServiceType(task.serviceType)
}
