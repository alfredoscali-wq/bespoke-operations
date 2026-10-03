import type { NetworkTargetProtocol, NetworkVendor } from "@/lib/network/constants"

export const DIAGNOSTIC_EXECUTABLE_JOB_TYPE = "diagnostic" as const

export type NetworkManagementAccessOption = {
  id: string
  label: string
  protocol: NetworkTargetProtocol
  port: number
}

export type NetworkManagementProfile = {
  vendor: NetworkVendor
  implemented: boolean
  accessOptions: NetworkManagementAccessOption[]
}

export function resolveNetworkManagementVendor(input: {
  manufacturer?: string | null
  platform?: string | null
  board?: string | null
}): NetworkVendor | null {
  const haystack = `${input.manufacturer ?? ""} ${input.platform ?? ""} ${input.board ?? ""}`.toLowerCase()
  if (/(mikrotik|routeros|routerboard)/.test(haystack)) return "mikrotik"
  if (/(ubiquiti|ubnt|unifi)/.test(haystack)) return "ubiquiti"
  if (/\bzte\b/.test(haystack)) return "zte"
  if (/huawei/.test(haystack)) return "huawei"
  if (/vsol/.test(haystack)) return "vsol"
  return null
}

export function mikrotikManagementProfile(): NetworkManagementProfile {
  return {
    vendor: "mikrotik",
    implemented: true,
    accessOptions: [
      {
        id: "api-8728",
        label: "API RouterOS",
        protocol: "api",
        port: 8728,
      },
      {
        id: "api-8729",
        label: "API RouterOS SSL",
        protocol: "api",
        port: 8729,
      },
    ],
  }
}

export function unimplementedManagementProfile(
  vendor: NetworkVendor
): NetworkManagementProfile {
  return {
    vendor,
    implemented: false,
    accessOptions: [],
  }
}

export function getNetworkManagementProfile(
  vendor: NetworkVendor | null
): NetworkManagementProfile | null {
  if (!vendor) return null
  if (vendor === "mikrotik") return mikrotikManagementProfile()
  return unimplementedManagementProfile(vendor)
}

export function selectManagementAccessOption(
  profile: NetworkManagementProfile,
  protocol: NetworkTargetProtocol,
  port: number
): NetworkManagementAccessOption | null {
  const exact = profile.accessOptions.find(
    (option) => option.protocol === protocol && option.port === port
  )
  if (exact) return exact
  const byProtocol = profile.accessOptions.find(
    (option) => option.protocol === protocol
  )
  if (!byProtocol) return null
  return {
    ...byProtocol,
    id: `${byProtocol.protocol}-${port}`,
    port,
  }
}

export function networkManagementVendorLabel(
  vendor: NetworkVendor | null | undefined
): string {
  if (vendor === "mikrotik") return "MikroTik"
  if (vendor === "ubiquiti") return "Ubiquiti"
  if (vendor === "zte") return "ZTE"
  if (vendor === "huawei") return "Huawei"
  if (vendor === "vsol") return "VSOL"
  return vendor ?? "—"
}
