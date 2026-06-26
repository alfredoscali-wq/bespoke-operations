import { parseCambioDomicilioFromTask } from "@/lib/tasks/cambio-domicilio"
import type {
  WorkOrderFormInput,
  WorkOrderServiceType,
} from "@/lib/tasks/work-order"
import type { Customer, UpdateCustomerInput } from "@/lib/types/customers"
import type { Task } from "@/lib/types/tasks"

export type CustomerSyncFieldKey =
  | "phone"
  | "email"
  | "address"
  | "locality"
  | "technology"

export type CustomerSyncSnapshot = Record<CustomerSyncFieldKey, string>

export type CustomerSyncFieldChange = {
  key: CustomerSyncFieldKey
  label: string
  before: string
  after: string
}

export const CUSTOMER_SYNC_FIELD_LABELS: Record<CustomerSyncFieldKey, string> = {
  phone: "Teléfono",
  email: "Email",
  address: "Domicilio",
  locality: "Localidad",
  technology: "Tecnología",
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim()
}

export function buildCustomerSyncSnapshotFromCustomer(
  customer: Customer
): CustomerSyncSnapshot {
  return {
    phone: normalize(customer.phone),
    email: normalize(customer.email),
    address: normalize(customer.address),
    locality: normalize(customer.locality),
    technology: normalize(customer.technology),
  }
}

function resolveEmailFromTask(task: Task): string {
  const metadataEmail = task.taskMetadata?.email
  return typeof metadataEmail === "string" ? normalize(metadataEmail) : ""
}

export function buildCustomerSyncSnapshotFromTask(task: Task): CustomerSyncSnapshot {
  if (task.serviceType === "cambio-domicilio") {
    const cambio = parseCambioDomicilioFromTask(task)
    return {
      phone: normalize(task.customerPhone),
      email: resolveEmailFromTask(task),
      address: normalize(cambio.new.address),
      locality: normalize(cambio.new.locality),
      technology: normalize(
        typeof task.taskMetadata?.technology === "string"
          ? task.taskMetadata.technology
          : task.type === "wireless"
            ? "wireless"
            : task.type === "fiber"
              ? "fiber"
              : ""
      ),
    }
  }

  return {
    phone: normalize(task.customerPhone),
    email: resolveEmailFromTask(task),
    address: normalize(task.serviceAddress),
    locality: normalize(task.locality),
    technology: normalize(
      typeof task.taskMetadata?.technology === "string"
        ? task.taskMetadata.technology
        : task.type === "wireless"
          ? "wireless"
          : task.type === "fiber"
            ? "fiber"
            : ""
    ),
  }
}

export function buildCustomerSyncSnapshotFromWorkOrderForm(
  form: WorkOrderFormInput
): CustomerSyncSnapshot {
  const serviceType = form.serviceType as WorkOrderServiceType

  if (serviceType === "cambio-domicilio") {
    return {
      phone: normalize(form.customerPhone),
      email: normalize(form.customerEmail),
      address: normalize(form.newAddress),
      locality: normalize(form.newLocality),
      technology: normalize(form.technology),
    }
  }

  return {
    phone: normalize(form.customerPhone),
    email: normalize(form.customerEmail),
    address: normalize(form.address),
    locality: normalize(form.locality),
    technology: normalize(form.technology),
  }
}

export function diffCustomerSyncSnapshots(
  baseline: CustomerSyncSnapshot,
  proposed: CustomerSyncSnapshot
): CustomerSyncFieldChange[] {
  const changes: CustomerSyncFieldChange[] = []

  for (const key of Object.keys(CUSTOMER_SYNC_FIELD_LABELS) as CustomerSyncFieldKey[]) {
    const before = baseline[key]
    const after = proposed[key]

    if (before === after) {
      continue
    }

    if (!after) {
      continue
    }

    changes.push({
      key,
      label: CUSTOMER_SYNC_FIELD_LABELS[key],
      before: before || "—",
      after,
    })
  }

  return changes
}

export function buildCustomerUpdateFromSyncChanges(
  changes: CustomerSyncFieldChange[],
  selectedKeys: CustomerSyncFieldKey[]
): UpdateCustomerInput {
  const selected = new Set(selectedKeys)
  const update: UpdateCustomerInput = {}

  for (const change of changes) {
    if (!selected.has(change.key)) {
      continue
    }

    switch (change.key) {
      case "phone":
        update.phone = change.after
        break
      case "email":
        update.email = change.after
        break
      case "address":
        update.address = change.after
        break
      case "locality":
        update.locality = change.after
        break
      case "technology":
        update.technology = change.after
        break
      default:
        break
    }
  }

  return update
}

export function shouldOfferCustomerSync(input: {
  customerId?: string | null
  serviceType: WorkOrderServiceType | ""
}): boolean {
  return Boolean(
    input.customerId?.trim() &&
      input.serviceType &&
      input.serviceType !== "instalacion-nueva"
  )
}
