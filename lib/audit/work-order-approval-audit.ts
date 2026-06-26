import { buildAuditDescription } from "@/lib/audit/build-audit-description"
import {
  buildAuditChangeMetadata,
  buildAuditFieldChanges,
} from "@/lib/audit/metadata-changes"
import { recordAuditEventClient } from "@/lib/audit/record-audit-event.client"
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
} from "@/lib/audit/types"
import type { Customer, UpdateCustomerInput } from "@/lib/types/customers"
import type { Task } from "@/lib/types/tasks"

const WORK_ORDER_APPROVAL_FIELD_LABELS: Partial<
  Record<keyof UpdateCustomerInput, string>
> = {
  technology: "technology",
  contractedPlan: "contractedPlan",
  address: "address",
  locality: "locality",
  latitude: "latitude",
  longitude: "longitude",
  sharedLocation: "sharedLocation",
  napBox: "napBox",
  napPort: "napPort",
  onuSerial: "onuSerial",
  status: "status",
  statusReason: "statusReason",
}

function resolveCustomerEntityLabel(
  customer: Pick<Customer, "name" | "customerNumber" | "externalCustomerCode" | "id">
) {
  return (
    customer.name?.trim() ||
    customer.externalCustomerCode?.trim() ||
    customer.customerNumber?.trim() ||
    customer.id
  )
}

function buildApprovalEffectMetadata(
  before: Customer,
  input: UpdateCustomerInput,
  task: Pick<Task, "id" | "code" | "serviceType">
) {
  const fields = Object.keys(input).filter(
    (key) => input[key as keyof UpdateCustomerInput] !== undefined
  ) as (keyof UpdateCustomerInput)[]

  const changes = buildAuditFieldChanges({
    before,
    updates: input,
    fields,
    labels: WORK_ORDER_APPROVAL_FIELD_LABELS,
  })

  return {
    ...buildAuditChangeMetadata(changes),
    effectSource: "work-order-approval",
    taskId: task.id,
    taskCode: task.code,
    serviceType: task.serviceType ?? null,
  }
}

export function recordWorkOrderApprovalCustomerEffectsAudit(
  before: Customer,
  input: UpdateCustomerInput,
  task: Pick<Task, "id" | "code" | "serviceType">
) {
  void recordAuditEventClient({
    module: AUDIT_MODULES.CLIENTES,
    action: AUDIT_ACTIONS.CUSTOMER_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
    entityId: before.id,
    entityLabel: resolveCustomerEntityLabel(before),
    description: buildAuditDescription({
      action: AUDIT_ACTIONS.CUSTOMER_UPDATE,
      entityLabel: resolveCustomerEntityLabel(before),
    }),
    metadata: buildApprovalEffectMetadata(before, input, task),
  })
}
