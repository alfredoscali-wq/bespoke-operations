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
