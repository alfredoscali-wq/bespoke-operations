import "server-only"

import type { NetworkVendor } from "@/lib/network/constants"
import { DIAGNOSTIC_EXECUTABLE_JOB_TYPE } from "@/lib/network/management/vendor"
import {
  getNetworkManagementProfile,
  type NetworkManagementProfile,
} from "@/lib/network/management/vendor"

export type NetworkManagementConnector = {
  vendor: NetworkVendor
  profile: NetworkManagementProfile
  diagnosticJobType: typeof DIAGNOSTIC_EXECUTABLE_JOB_TYPE
  discoveryJobType: "discovery"
}

export function getNetworkManagementConnector(
  vendor: NetworkVendor
): NetworkManagementConnector | { error: string } {
  const profile = getNetworkManagementProfile(vendor)
  if (!profile) {
    return { error: "No hay un conector de administración para este fabricante." }
  }
  if (!profile.implemented) {
    return {
      error: `El conector ${vendor} todavía no está implementado.`,
    }
  }
  return {
    vendor,
    profile,
    diagnosticJobType: DIAGNOSTIC_EXECUTABLE_JOB_TYPE,
    discoveryJobType: "discovery",
  }
}
