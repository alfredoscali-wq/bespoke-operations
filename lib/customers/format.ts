import { WORK_ORDER_TECHNOLOGY_OPTIONS } from "@/lib/tasks/work-order"

export function formatCustomerTechnologyLabel(
  technology?: string | null
): string | null {
  if (!technology) {
    return null
  }

  return (
    WORK_ORDER_TECHNOLOGY_OPTIONS.find((option) => option.value === technology)
      ?.label ?? technology
  )
}

export function formatCustomerAddressLabel(customer: {
  address?: string | null
  locality?: string | null
}): string | null {
  const address = customer.address?.trim()
  const locality = customer.locality?.trim()

  if (address && locality) {
    return `${address} - ${locality}`
  }

  return address || locality || null
}

export function formatCustomerStatusLabel(status: string): string {
  const normalized = status.trim().toLowerCase()

  if (normalized === "activo") {
    return "Activo"
  }

  if (normalized === "inactivo") {
    return "Inactivo"
  }

  return status.trim() || "Sin estado"
}

export function isCustomerStatusActive(status: string): boolean {
  return status.trim().toLowerCase() === "activo"
}
