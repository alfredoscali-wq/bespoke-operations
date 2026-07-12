import type { QuickCustomerInput } from "@/lib/types/customers"
import type { CreateCustomerPayload } from "@/lib/types/supabase/customers"

export function validateQuickCustomerInput(
  input: QuickCustomerInput
): string | null {
  if (!input.name.trim()) {
    return "Completá el nombre del cliente."
  }

  return null
}

export function mapQuickCustomerToCreatePayload(
  input: QuickCustomerInput,
  companyId: string
): Omit<CreateCustomerPayload, "customerNumber"> {
  return {
    companyId,
    name: input.name.trim(),
    phone: input.phone?.trim() || undefined,
    dni: input.dni?.trim() || undefined,
    status: "activo",
    validationStatus: "review",
  }
}
