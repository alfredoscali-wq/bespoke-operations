import { isCustomerStatusActive } from "@/lib/customers/format"
import type { Customer } from "@/lib/types/customers"

/**
 * Clientes elegibles para OT de reconexión: comercialmente inactivos o suspendidos.
 * Incluye legacy B/P cuando el campo status aún figura activo.
 */
export function isCustomerEligibleForReconexion(
  customer: Pick<Customer, "status" | "legacyClientState">
): boolean {
  if (!isCustomerStatusActive(customer.status)) {
    return true
  }

  const legacy = customer.legacyClientState?.trim().toUpperCase()
  return legacy === "B" || legacy === "P"
}

export function validateReconexionCustomer(
  customer: Pick<Customer, "status" | "legacyClientState"> | null | undefined
): { valid: boolean; message?: string } {
  if (!customer) {
    return { valid: false, message: "Cliente no encontrado." }
  }

  if (!isCustomerEligibleForReconexion(customer)) {
    return {
      valid: false,
      message:
        "La reconexión solo aplica a clientes suspendidos o inactivos.",
    }
  }

  return { valid: true }
}
