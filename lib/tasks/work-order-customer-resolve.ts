export function readWorkOrderFormCustomerId(
  value: string | null | undefined
): string {
  return value?.trim() ?? ""
}

function isNewInstallationServiceType(
  serviceType: string | null | undefined
): boolean {
  return serviceType === "instalacion-nueva"
}

function requiresCustomerLookupServiceType(
  serviceType: string | null | undefined
): boolean {
  return Boolean(serviceType) && serviceType !== "instalacion-nueva"
}

export type WorkOrderCustomerResolution =
  | { action: "reuse"; customerId: string }
  | { action: "create" }
  | { action: "require-lookup" }

export function planWorkOrderCustomerResolution(input: {
  serviceType: string | null | undefined
  formCustomerId: string | null | undefined
  isEditMode: boolean
  taskCustomerId?: string | null
}): WorkOrderCustomerResolution {
  const formCustomerId = readWorkOrderFormCustomerId(input.formCustomerId)

  if (isNewInstallationServiceType(input.serviceType)) {
    if (input.isEditMode) {
      return {
        action: "reuse",
        customerId:
          formCustomerId || readWorkOrderFormCustomerId(input.taskCustomerId),
      }
    }

    if (formCustomerId) {
      return { action: "reuse", customerId: formCustomerId }
    }

    return { action: "create" }
  }

  if (requiresCustomerLookupServiceType(input.serviceType) && !formCustomerId) {
    return { action: "require-lookup" }
  }

  return { action: "reuse", customerId: formCustomerId }
}

export function didReuseExistingCustomerForInstallation(input: {
  serviceType: string | null | undefined
  formCustomerId: string | null | undefined
  resolvedCustomerId: string | null | undefined
}): boolean {
  if (!isNewInstallationServiceType(input.serviceType)) {
    return false
  }

  const formCustomerId = readWorkOrderFormCustomerId(input.formCustomerId)
  const resolvedCustomerId = readWorkOrderFormCustomerId(input.resolvedCustomerId)
  return Boolean(formCustomerId && formCustomerId === resolvedCustomerId)
}

export function applyReusedExistingCustomerMetadata(
  metadata: Record<string, unknown>,
  input: {
    serviceType: string | null | undefined
    formCustomerId: string | null | undefined
    resolvedCustomerId: string | null | undefined
  }
): Record<string, unknown> {
  if (!didReuseExistingCustomerForInstallation(input)) {
    return metadata
  }

  return {
    ...metadata,
    reusedExistingCustomer: true,
  }
}

export function preserveReusedExistingCustomerMetadata(
  metadata: Record<string, unknown> | undefined,
  existingMetadata: Record<string, unknown> | undefined
): Record<string, unknown> {
  const next = { ...(metadata ?? {}) }

  if (existingMetadata?.reusedExistingCustomer === true) {
    next.reusedExistingCustomer = true
  } else {
    delete next.reusedExistingCustomer
  }

  return next
}

export function didTaskReuseExistingCustomer(
  metadata: Record<string, unknown> | undefined
): boolean {
  return metadata?.reusedExistingCustomer === true
}
