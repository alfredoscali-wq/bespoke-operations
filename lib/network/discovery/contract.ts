/** Shared Agent ↔ Cloud discovery contract. No vendor access logic. */

import type {
  NetworkDeviceStatus,
  NetworkDeviceType,
  NetworkTargetProtocol,
  NetworkVendor,
} from "@/lib/network/constants"

export type DiscoveryAddress = {
  address: string
  prefixLength: number | null
}

export type DiscoveryInterface = {
  name: string
  description: string | null
  macAddress: string | null
  status: string | null
  speedMbps: number | null
  interfaceType: string | null
  addresses: DiscoveryAddress[]
}

export type DiscoveryDevice = {
  /** Stable key within this snapshot (e.g. "target", "neighbor:aa:bb"). */
  localKey: string
  hostname: string | null
  manufacturer: string | null
  model: string | null
  serialNumber: string | null
  deviceType: NetworkDeviceType
  managementIp: string | null
  macAddress: string | null
  firmwareVersion: string | null
  status: NetworkDeviceStatus
  origin: "discovery" | "neighbor"
  interfaces: DiscoveryInterface[]
}

export type DiscoveryLink = {
  fromLocalKey: string
  fromInterfaceName: string | null
  toLocalKey: string
  toInterfaceName: string | null
  protocol: string | null
}

export type DiscoverySnapshot = {
  vendor: NetworkVendor
  targetId: string
  siteId: string | null
  devices: DiscoveryDevice[]
  links: DiscoveryLink[]
  warnings: string[]
}

export type DiscoveryJobPayload = {
  targetId: string
  vendor: NetworkVendor
  host: string
  siteId: string | null
}

export type DiscoveryJobExecution = {
  vendor: NetworkVendor
  host: string
  port: number
  protocol: NetworkTargetProtocol
  username: string
  password: string
}

export type DiscoveryJobCompactResult = {
  vendor: NetworkVendor
  targetId: string
  deviceCount: number
  interfaceCount: number
  linkCount: number
  warnings: string[]
  primaryHostname: string | null
  primaryManagementIp: string | null
}

export const DISCOVERY_EXECUTABLE_JOB_TYPE = "discovery" as const
