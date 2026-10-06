import {
  CLIENTS_360_COMMERCIAL_CUSTOMER_IDS,
  CLIENTS_360_UNIVERSE_CONTROL,
} from "@/lib/isp/clients-360-commercial-ids"

const COMMERCIAL_UNIVERSE = new Set<string>(CLIENTS_360_COMMERCIAL_CUSTOMER_IDS)

export function getClients360CommercialUniverse(): readonly string[] {
  return CLIENTS_360_COMMERCIAL_CUSTOMER_IDS
}

export function isCustomerInClients360Universe(customerId: string): boolean {
  return COMMERCIAL_UNIVERSE.has(customerId)
}

export { CLIENTS_360_UNIVERSE_CONTROL }
