import type { CustomerImportStatus } from "@/lib/customers/customer-import/types"
import {
  normalizeComparisonKey,
  normalizeDni,
  normalizeEmail,
  normalizeLocalityName,
  normalizePhone,
  resolveImportStatus,
  resolveImportTechnology,
} from "@/lib/customers/normalization"

export {
  isValidEmail,
  normalizeComparisonKey as normalizeDuplicateKey,
  resolveImportStatus,
  resolveImportTechnology,
} from "@/lib/customers/normalization"

export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) {
    return value.toISOString()
  }
  return String(value).trim()
}

export function normalizeImportFieldValues(input: {
  externalCustomerCode: string
  name: string
  phone: string
  email: string
  address: string
  locality: string
  technology: string
  status: string
}): {
  externalCustomerCode: string
  name: string
  phone: string
  email: string
  address: string
  locality: string
  technology: ReturnType<typeof resolveImportTechnology>
  status: CustomerImportStatus
} {
  const phone = normalizePhone(input.phone)
  const email = normalizeEmail(input.email)
  const locality = normalizeLocalityName(input.locality)
  const status = resolveImportStatus(input.status)

  return {
    externalCustomerCode: input.externalCustomerCode.trim(),
    name: input.name.trim(),
    phone: phone.national || phone.digits,
    email: email.normalized,
    address: input.address.trim(),
    locality: locality.normalized,
    technology: resolveImportTechnology(input.technology) || "",
    status: status || "",
  }
}
