import type { Database, Json } from "@/lib/supabase/database.types"
import {
  isNetworkAgentStatus,
  isNetworkJobType,
  isNetworkSiteKind,
  isNetworkTargetProtocol,
  isNetworkVendor,
} from "@/lib/network/integrity"
import {
  NETWORK_DEVICE_ORIGINS,
  NETWORK_DEVICE_STATUSES,
  NETWORK_DEVICE_TYPES,
  type NetworkDeviceOrigin,
  type NetworkDeviceStatus,
  type NetworkDeviceType,
  type NetworkJobStatus,
} from "@/lib/network/constants"
import type {
  NetworkAgent,
  NetworkAgentJob,
  NetworkDevice,
  NetworkDiscoveryTarget,
  NetworkInterface,
  NetworkInterfaceAddress,
  NetworkLink,
  NetworkSite,
} from "@/lib/network/types"

type NetworkSiteRow = Database["public"]["Tables"]["network_sites"]["Row"]
type NetworkAgentRow = Database["public"]["Tables"]["network_agents"]["Row"]
type NetworkJobRow = Database["public"]["Tables"]["network_agent_jobs"]["Row"]
type NetworkDeviceRow = Database["public"]["Tables"]["network_devices"]["Row"]
type NetworkInterfaceRow = Database["public"]["Tables"]["network_interfaces"]["Row"]
type NetworkLinkRow = Database["public"]["Tables"]["network_links"]["Row"]
type NetworkTargetRow = Database["public"]["Tables"]["network_discovery_targets"]["Row"]

export function mapNetworkSiteRow(
  row: NetworkSiteRow,
  agentCount = 0
): NetworkSite {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    kind: isNetworkSiteKind(row.kind) ? row.kind : "other",
    description: row.description,
    address: row.address,
    locality: row.locality,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    agentCount,
  }
}

export function mapNetworkAgentRow(
  row: NetworkAgentRow,
  siteName: string | null
): NetworkAgent {
  return {
    id: row.id,
    companyId: row.company_id,
    siteId: row.site_id,
    siteName,
    name: row.name,
    status: isNetworkAgentStatus(row.status) ? row.status : "pending",
    version: row.version,
    hostname: row.hostname,
    lastSeenAt: row.last_seen_at,
    enrolledAt: row.enrolled_at,
    hasEnrollmentToken: Boolean(row.enrollment_token_hash),
    hasCredential: Boolean(row.credential_token_hash),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function asJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

export function mapNetworkJobRow(
  row: NetworkJobRow,
  agentName?: string | null
): NetworkAgentJob {
  return {
    id: row.id,
    companyId: row.company_id,
    agentId: row.agent_id,
    agentName: agentName ?? null,
    siteId: row.site_id,
    jobType: isNetworkJobType(row.job_type) ? row.job_type : "verification",
    status: row.status as NetworkJobStatus,
    payload: asJsonObject(row.payload) ?? {},
    result: asJsonObject(row.result),
    errorMessage: row.error_message,
    dispatchedAt: row.dispatched_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function isDeviceType(value: string): value is NetworkDeviceType {
  return (NETWORK_DEVICE_TYPES as readonly string[]).includes(value)
}

function isDeviceStatus(value: string): value is NetworkDeviceStatus {
  return (NETWORK_DEVICE_STATUSES as readonly string[]).includes(value)
}

function isDeviceOrigin(value: string): value is NetworkDeviceOrigin {
  return (NETWORK_DEVICE_ORIGINS as readonly string[]).includes(value)
}

export function mapNetworkDeviceRow(
  row: NetworkDeviceRow,
  extras?: {
    siteName?: string | null
    agentName?: string | null
    operationalStatus?: "unknown" | "online" | "offline" | "degraded"
  }
): NetworkDevice {
  return {
    id: row.id,
    companyId: row.company_id,
    agentId: row.agent_id,
    agentName: extras?.agentName ?? null,
    siteId: row.site_id,
    siteName: extras?.siteName ?? null,
    fingerprint: row.fingerprint,
    hostname: row.hostname,
    manufacturer: row.manufacturer,
    model: row.model,
    serialNumber: row.serial_number,
    deviceType: isDeviceType(row.device_type) ? row.device_type : "other",
    managementIp: row.management_ip,
    macAddress: row.mac_address,
    firmwareVersion: row.firmware_version,
    status: isDeviceStatus(row.status) ? row.status : "unknown",
    origin: isDeviceOrigin(row.origin) ? row.origin : "discovery",
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    operationalStatus: extras?.operationalStatus ?? "unknown",
  }
}

export function mapNetworkInterfaceAddresses(
  value: Json | null
): NetworkInterfaceAddress[] {
  if (!Array.isArray(value)) return []
  const addresses: NetworkInterfaceAddress[] = []
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const record = item as Record<string, unknown>
    if (typeof record.address !== "string" || !record.address.trim()) continue
    addresses.push({
      address: record.address.trim(),
      prefixLength:
        typeof record.prefixLength === "number" ? record.prefixLength : null,
    })
  }
  return addresses
}

export function mapNetworkInterfaceRow(row: NetworkInterfaceRow): NetworkInterface {
  return {
    id: row.id,
    companyId: row.company_id,
    deviceId: row.device_id,
    name: row.name,
    description: row.description,
    macAddress: row.mac_address,
    addresses: mapNetworkInterfaceAddresses(row.addresses),
    status: row.status,
    speedMbps: row.speed_mbps,
    interfaceType: row.interface_type,
    lastSeenAt: row.last_seen_at,
  }
}

export function mapNetworkLinkRow(
  row: NetworkLinkRow,
  extras?: {
    fromHostname?: string | null
    fromInterfaceName?: string | null
    toHostname?: string | null
    toInterfaceName?: string | null
  }
): NetworkLink {
  return {
    id: row.id,
    companyId: row.company_id,
    fromDeviceId: row.from_device_id,
    fromDeviceHostname: extras?.fromHostname ?? null,
    fromInterfaceId: row.from_interface_id,
    fromInterfaceName: extras?.fromInterfaceName ?? null,
    toDeviceId: row.to_device_id,
    toDeviceHostname: extras?.toHostname ?? null,
    toInterfaceId: row.to_interface_id,
    toInterfaceName: extras?.toInterfaceName ?? null,
    protocol: row.protocol,
    lastSeenAt: row.last_seen_at,
  }
}

export function mapNetworkTargetRow(
  row: Pick<
    NetworkTargetRow,
    | "id"
    | "company_id"
    | "agent_id"
    | "site_id"
    | "name"
    | "vendor"
    | "host"
    | "port"
    | "protocol"
    | "created_at"
    | "updated_at"
  > & { secret_ciphertext?: string | null },
  extras?: { agentName?: string | null; siteName?: string | null }
): NetworkDiscoveryTarget {
  return {
    id: row.id,
    companyId: row.company_id,
    agentId: row.agent_id,
    agentName: extras?.agentName ?? null,
    siteId: row.site_id,
    siteName: extras?.siteName ?? null,
    name: row.name,
    vendor: isNetworkVendor(row.vendor) ? row.vendor : "mikrotik",
    host: row.host,
    port: row.port,
    protocol: isNetworkTargetProtocol(row.protocol) ? row.protocol : "api",
    hasSecret: Boolean(row.secret_ciphertext),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
