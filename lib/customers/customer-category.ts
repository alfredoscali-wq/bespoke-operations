import type { Customer } from "@/lib/types/customers"
import type { VisualTone } from "@/lib/ui/visual-tokens"

export type CustomerCategory = "activo" | "inactivo" | "fiber" | "wireless"

export const CUSTOMER_CATEGORY_ORDER: CustomerCategory[] = [
  "activo",
  "inactivo",
  "fiber",
  "wireless",
]

export const CUSTOMER_CATEGORY_KPI_LABELS: Record<CustomerCategory, string> = {
  activo: "Clientes Activos",
  inactivo: "Clientes Inactivos",
  fiber: "Fibra",
  wireless: "Wireless",
}

export const CUSTOMER_CATEGORY_KPI_TONE: Record<CustomerCategory, VisualTone> = {
  activo: "green",
  inactivo: "gray",
  fiber: "blue",
  wireless: "violet",
}

export function isCustomerActive(customer: Pick<Customer, "status">): boolean {
  return customer.status.trim().toLowerCase() === "activo"
}

export function countCustomersByCategory(
  customers: Customer[]
): Record<CustomerCategory, number> {
  return {
    activo: customers.filter(isCustomerActive).length,
    inactivo: customers.filter((customer) => !isCustomerActive(customer)).length,
    fiber: customers.filter((customer) => customer.technology === "fiber").length,
    wireless: customers.filter((customer) => customer.technology === "wireless")
      .length,
  }
}

export function filterCustomersByCategory(
  customers: Customer[],
  category: CustomerCategory | null
): Customer[] {
  if (!category) {
    return customers
  }

  switch (category) {
    case "activo":
      return customers.filter(isCustomerActive)
    case "inactivo":
      return customers.filter((customer) => !isCustomerActive(customer))
    case "fiber":
      return customers.filter((customer) => customer.technology === "fiber")
    case "wireless":
      return customers.filter((customer) => customer.technology === "wireless")
  }
}
