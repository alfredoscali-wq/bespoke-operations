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

const CUSTOMER_UPDATE_FIELD_LABELS: Partial<Record<keyof UpdateCustomerInput, string>> =
  {
    name: "name",
    externalCustomerCode: "externalCustomerCode",
    dni: "dni",
    phone: "phone",
    email: "email",
    address: "address",
    locality: "locality",
    technology: "technology",
    status: "status",
    validationStatus: "validationStatus",
    legacyClientState: "legacyClientState",
    legacyMigrationId: "legacyMigrationId",
  }

const CUSTOMER_UPDATE_AUDIT_FIELDS = Object.keys(
  CUSTOMER_UPDATE_FIELD_LABELS
) as (keyof UpdateCustomerInput)[]

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

function buildCustomerUpdateChangeMetadata(
  before: Customer,
  input: UpdateCustomerInput
) {
  const changes = buildAuditFieldChanges({
    before,
    updates: input,
    fields: CUSTOMER_UPDATE_AUDIT_FIELDS.filter(
      (field) => input[field] !== undefined
    ),
    labels: CUSTOMER_UPDATE_FIELD_LABELS,
  })

  return buildAuditChangeMetadata(changes)
}

export function recordCustomerCreateAudit(customer: Customer) {
  void recordAuditEventClient({
    module: AUDIT_MODULES.CLIENTES,
    action: AUDIT_ACTIONS.CUSTOMER_CREATE,
    entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
    entityId: customer.id,
    entityLabel: resolveCustomerEntityLabel(customer),
    description: buildAuditDescription({
      action: AUDIT_ACTIONS.CUSTOMER_CREATE,
      entityLabel: resolveCustomerEntityLabel(customer),
    }),
    metadata: {
      customerNumber: customer.customerNumber,
      externalCustomerCode: customer.externalCustomerCode ?? null,
      validationStatus: customer.validationStatus,
    },
  })
}

export function recordCustomerUpdateAudit(before: Customer, input: UpdateCustomerInput) {
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
    metadata: buildCustomerUpdateChangeMetadata(before, input),
  })
}

export function recordCustomerSyncFromWorkOrderAudit(
  before: Customer,
  input: UpdateCustomerInput,
  task: { id: string; code: string }
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
    metadata: {
      ...buildCustomerUpdateChangeMetadata(before, input),
      syncSource: "work-order",
      taskId: task.id,
      taskCode: task.code,
    },
  })
}

export function recordCustomerArchiveAudit(
  customer: Pick<Customer, "id" | "name" | "customerNumber" | "externalCustomerCode">
) {
  void recordAuditEventClient({
    module: AUDIT_MODULES.CLIENTES,
    action: AUDIT_ACTIONS.CUSTOMER_ARCHIVE,
    entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
    entityId: customer.id,
    entityLabel: resolveCustomerEntityLabel(customer),
    description: buildAuditDescription({
      action: AUDIT_ACTIONS.CUSTOMER_ARCHIVE,
      entityLabel: resolveCustomerEntityLabel(customer),
    }),
    metadata: {
      archivedAt: new Date().toISOString(),
    },
  })
}

export function recordCustomerDeleteAudit(
  customer: Pick<Customer, "id" | "name" | "customerNumber" | "externalCustomerCode">
) {
  void recordAuditEventClient({
    module: AUDIT_MODULES.CLIENTES,
    action: AUDIT_ACTIONS.CUSTOMER_DELETE,
    entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
    entityId: customer.id,
    entityLabel: resolveCustomerEntityLabel(customer),
    description: buildAuditDescription({
      action: AUDIT_ACTIONS.CUSTOMER_DELETE,
      entityLabel: resolveCustomerEntityLabel(customer),
    }),
    metadata: {
      deletedAt: new Date().toISOString(),
    },
  })
}

export function recordCustomerValidateAudit(
  customer: Pick<
    Customer,
    "id" | "name" | "customerNumber" | "externalCustomerCode" | "validationStatus"
  >,
  validatedBy: string
) {
  void recordAuditEventClient({
    module: AUDIT_MODULES.CLIENTES,
    action: AUDIT_ACTIONS.CUSTOMER_VALIDATE,
    entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
    entityId: customer.id,
    entityLabel: resolveCustomerEntityLabel(customer),
    description: buildAuditDescription({
      action: AUDIT_ACTIONS.CUSTOMER_VALIDATE,
      entityLabel: resolveCustomerEntityLabel(customer),
    }),
    metadata: {
      validatedBy,
      changes: [
        {
          campo: "validationStatus",
          valor_anterior: customer.validationStatus,
          valor_nuevo: "active",
        },
      ],
      previousValidationStatus: customer.validationStatus,
      nextValidationStatus: "active",
    },
  })
}

export function isCustomerArchiveUpdate(input: UpdateCustomerInput): boolean {
  return input.deletedAt !== undefined && input.deletedAt !== null
}
