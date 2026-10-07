import { abnetNumberFromExternalCode } from "@/lib/isp/abnet-master-universe"

export type BespokeLatamCustomer = {
  companyId: string
  deletedAt?: string | null
  externalCustomerCode?: string | null
}

export type BespokeLatamIdentifier =
  | { status: "ready"; identifier: string }
  | { status: "not_found" }
  | { status: "missing_identifier" }

/** N° ABNet of a customer that belongs to the current company. */
export function latamIdentifierFromCustomer(
  customer: BespokeLatamCustomer | null,
  companyId: string
): BespokeLatamIdentifier {
  if (!customer || customer.deletedAt || customer.companyId !== companyId) {
    return { status: "not_found" }
  }
  const identifier = abnetNumberFromExternalCode(customer.externalCustomerCode)
  if (!identifier) return { status: "missing_identifier" }
  return { status: "ready", identifier }
}
