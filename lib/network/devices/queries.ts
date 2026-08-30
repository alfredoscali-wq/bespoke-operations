import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json } from "@/lib/supabase/database.types"
import { buildDeviceFingerprint } from "@/lib/network/discovery/fingerprint"
import type { DiscoverySnapshot } from "@/lib/network/discovery/contract"
import {
  mapNetworkDeviceRow,
  mapNetworkInterfaceRow,
  mapNetworkLinkRow,
} from "@/lib/network/mapper"
import {
  getNetworkDeviceMonitoring,
  listNetworkDeviceOperationalStatuses,
} from "@/lib/network/monitoring/queries"
import type {
  NetworkDevice,
  NetworkDeviceDetail,
  NetworkInterface,
  NetworkLink,
} from "@/lib/network/types"

type Client = SupabaseClient<Database>
type DeviceRow = Database["public"]["Tables"]["network_devices"]["Row"]
type InterfaceRow = Database["public"]["Tables"]["network_interfaces"]["Row"]

export async function listNetworkDevices(
  client: Client,
  companyId: string
): Promise<NetworkDevice[]> {
  const { data, error } = await client
    .from("network_devices")
    .select("*, network_sites ( name ), network_agents ( name )")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("last_seen_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const statuses = await listNetworkDeviceOperationalStatuses(client, companyId)

  return (data ?? []).map((row) => {
    const site = row.network_sites as { name: string } | null
    const agent = row.network_agents as { name: string } | null
    const operational = statuses.get(row.id)
    return mapNetworkDeviceRow(row, {
      siteName: site?.name ?? null,
      agentName: agent?.name ?? null,
      operationalStatus:
        operational === "online" || operational === "offline" || operational === "degraded"
          ? operational
          : "unknown",
    })
  })
}

export async function getNetworkDeviceDetail(
  client: Client,
  companyId: string,
  deviceId: string
): Promise<NetworkDeviceDetail | null> {
  const { data, error } = await client
    .from("network_devices")
    .select("*, network_sites ( name ), network_agents ( name )")
    .eq("company_id", companyId)
    .eq("id", deviceId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!data) return null

  const site = data.network_sites as { name: string } | null
  const agent = data.network_agents as { name: string } | null
  const device = mapNetworkDeviceRow(data, {
    siteName: site?.name ?? null,
    agentName: agent?.name ?? null,
  })

  const [interfaces, links, monitoring] = await Promise.all([
    listDeviceInterfaces(client, companyId, deviceId),
    listDeviceLinks(client, companyId, deviceId),
    getNetworkDeviceMonitoring(client, companyId, deviceId),
  ])

  return {
    ...device,
    operationalStatus: monitoring?.status ?? "unknown",
    interfaces,
    links,
    monitoring,
  }
}

async function listDeviceInterfaces(
  client: Client,
  companyId: string,
  deviceId: string
): Promise<NetworkInterface[]> {
  const { data, error } = await client
    .from("network_interfaces")
    .select("*")
    .eq("company_id", companyId)
    .eq("device_id", deviceId)
    .is("deleted_at", null)
    .order("name", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map(mapNetworkInterfaceRow)
}

async function listDeviceLinks(
  client: Client,
  companyId: string,
  deviceId: string
): Promise<NetworkLink[]> {
  const { data, error } = await client
    .from("network_links")
    .select(
      "*, from_device:network_devices!network_links_from_device_id_fkey ( hostname ), to_device:network_devices!network_links_to_device_id_fkey ( hostname ), from_interface:network_interfaces!network_links_from_interface_id_fkey ( name ), to_interface:network_interfaces!network_links_to_interface_id_fkey ( name )"
    )
    .eq("company_id", companyId)
    .or(`from_device_id.eq.${deviceId},to_device_id.eq.${deviceId}`)
    .is("deleted_at", null)
    .order("last_seen_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => {
    const fromDevice = row.from_device as { hostname: string | null } | null
    const toDevice = row.to_device as { hostname: string | null } | null
    const fromInterface = row.from_interface as { name: string } | null
    const toInterface = row.to_interface as { name: string } | null
    return mapNetworkLinkRow(row, {
      fromHostname: fromDevice?.hostname ?? null,
      toHostname: toDevice?.hostname ?? null,
      fromInterfaceName: fromInterface?.name ?? null,
      toInterfaceName: toInterface?.name ?? null,
    })
  })
}

export async function persistDiscoverySnapshot(
  client: Client,
  input: {
    companyId: string
    agentId: string
    siteId: string | null
    snapshot: DiscoverySnapshot
  }
): Promise<{
  deviceCount: number
  interfaceCount: number
  linkCount: number
  primaryHostname: string | null
  primaryManagementIp: string | null
}> {
  const now = new Date().toISOString()
  const deviceIds = new Map<string, string>()
  const interfacesByDevice = new Map<string, InterfaceRow[]>()
  let interfaceCount = 0

  for (const device of input.snapshot.devices) {
    const fingerprint = buildDeviceFingerprint({
      serialNumber: device.serialNumber,
      macAddress: device.macAddress,
      managementIp: device.managementIp,
      manufacturer: device.manufacturer,
      neighborIdentity: device.hostname,
    })

    const row = await upsertNetworkDevice(client, {
      companyId: input.companyId,
      agentId: input.agentId,
      siteId: input.siteId,
      fingerprint,
      device,
      seenAt: now,
    })
    deviceIds.set(device.localKey, row.id)

    const ifaces: InterfaceRow[] = []
    for (const iface of device.interfaces) {
      const saved = await upsertNetworkInterface(client, {
        companyId: input.companyId,
        deviceId: row.id,
        iface,
        seenAt: now,
      })
      ifaces.push(saved)
      interfaceCount += 1
    }
    interfacesByDevice.set(row.id, ifaces)
  }

  let linkCount = 0
  for (const link of input.snapshot.links) {
    const fromDeviceId = deviceIds.get(link.fromLocalKey)
    const toDeviceId = deviceIds.get(link.toLocalKey)
    if (!fromDeviceId || !toDeviceId) continue

    const fromInterfaceId = findInterfaceId(
      interfacesByDevice.get(fromDeviceId) ?? [],
      link.fromInterfaceName
    )
    const toInterfaceId = findInterfaceId(
      interfacesByDevice.get(toDeviceId) ?? [],
      link.toInterfaceName
    )

    await upsertNetworkLink(client, {
      companyId: input.companyId,
      fromDeviceId,
      fromInterfaceId,
      toDeviceId,
      toInterfaceId,
      protocol: link.protocol,
      seenAt: now,
    })
    linkCount += 1
  }

  const primary = input.snapshot.devices.find((item) => item.origin === "discovery")
    ?? input.snapshot.devices[0]

  return {
    deviceCount: deviceIds.size,
    interfaceCount,
    linkCount,
    primaryHostname: primary?.hostname ?? null,
    primaryManagementIp: primary?.managementIp ?? null,
  }
}

async function upsertNetworkDevice(
  client: Client,
  input: {
    companyId: string
    agentId: string
    siteId: string | null
    fingerprint: string
    device: DiscoverySnapshot["devices"][number]
    seenAt: string
  }
): Promise<DeviceRow> {
  const { data: existing, error: findError } = await client
    .from("network_devices")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("fingerprint", input.fingerprint)
    .is("deleted_at", null)
    .maybeSingle()

  if (findError) {
    throw new Error(findError.message)
  }

  const patch = {
    agent_id: input.agentId,
    site_id: input.siteId ?? existing?.site_id ?? null,
    hostname: input.device.hostname ?? existing?.hostname ?? null,
    manufacturer: input.device.manufacturer ?? existing?.manufacturer ?? null,
    model: input.device.model ?? existing?.model ?? null,
    serial_number: input.device.serialNumber ?? existing?.serial_number ?? null,
    device_type: input.device.deviceType,
    management_ip: input.device.managementIp ?? existing?.management_ip ?? null,
    mac_address: input.device.macAddress ?? existing?.mac_address ?? null,
    firmware_version:
      input.device.firmwareVersion ?? existing?.firmware_version ?? null,
    status: input.device.status,
    origin: existing?.origin === "discovery" ? "discovery" : input.device.origin,
    last_seen_at: input.seenAt,
  }

  if (existing) {
    const { data, error } = await client
      .from("network_devices")
      .update(patch)
      .eq("id", existing.id)
      .eq("company_id", input.companyId)
      .select("*")
      .single()
    if (error || !data) {
      throw new Error(error?.message ?? "No se pudo actualizar el dispositivo.")
    }
    return data
  }

  const { data, error } = await client
    .from("network_devices")
    .insert({
      company_id: input.companyId,
      fingerprint: input.fingerprint,
      first_seen_at: input.seenAt,
      ...patch,
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo guardar el dispositivo.")
  }

  return data
}

async function upsertNetworkInterface(
  client: Client,
  input: {
    companyId: string
    deviceId: string
    iface: DiscoverySnapshot["devices"][number]["interfaces"][number]
    seenAt: string
  }
): Promise<InterfaceRow> {
  const { data: existing, error: findError } = await client
    .from("network_interfaces")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("device_id", input.deviceId)
    .eq("name", input.iface.name.trim())
    .is("deleted_at", null)
    .maybeSingle()

  if (findError) {
    throw new Error(findError.message)
  }

  const patch = {
    description: input.iface.description,
    mac_address: input.iface.macAddress,
    addresses: input.iface.addresses as Json,
    status: input.iface.status,
    speed_mbps: input.iface.speedMbps,
    interface_type: input.iface.interfaceType,
    last_seen_at: input.seenAt,
  }

  if (existing) {
    const { data, error } = await client
      .from("network_interfaces")
      .update(patch)
      .eq("id", existing.id)
      .eq("company_id", input.companyId)
      .select("*")
      .single()
    if (error || !data) {
      throw new Error(error?.message ?? "No se pudo actualizar la interfaz.")
    }
    return data
  }

  const { data, error } = await client
    .from("network_interfaces")
    .insert({
      company_id: input.companyId,
      device_id: input.deviceId,
      name: input.iface.name.trim(),
      ...patch,
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo guardar la interfaz.")
  }

  return data
}

async function upsertNetworkLink(
  client: Client,
  input: {
    companyId: string
    fromDeviceId: string
    fromInterfaceId: string | null
    toDeviceId: string
    toInterfaceId: string | null
    protocol: string | null
    seenAt: string
  }
): Promise<void> {
  let query = client
    .from("network_links")
    .select("id")
    .eq("company_id", input.companyId)
    .eq("from_device_id", input.fromDeviceId)
    .eq("to_device_id", input.toDeviceId)
    .is("deleted_at", null)

  query = input.fromInterfaceId
    ? query.eq("from_interface_id", input.fromInterfaceId)
    : query.is("from_interface_id", null)
  query = input.toInterfaceId
    ? query.eq("to_interface_id", input.toInterfaceId)
    : query.is("to_interface_id", null)

  const { data: existing, error: findError } = await query.maybeSingle()
  if (findError) {
    throw new Error(findError.message)
  }

  if (existing) {
    const { error } = await client
      .from("network_links")
      .update({
        protocol: input.protocol,
        last_seen_at: input.seenAt,
      })
      .eq("id", existing.id)
      .eq("company_id", input.companyId)
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await client.from("network_links").insert({
    company_id: input.companyId,
    from_device_id: input.fromDeviceId,
    from_interface_id: input.fromInterfaceId,
    to_device_id: input.toDeviceId,
    to_interface_id: input.toInterfaceId,
    protocol: input.protocol,
    last_seen_at: input.seenAt,
  })
  if (error) {
    throw new Error(error.message)
  }
}

function findInterfaceId(
  interfaces: InterfaceRow[],
  name: string | null
): string | null {
  if (!name) return null
  const match = interfaces.find(
    (item) => item.name.trim().toLowerCase() === name.trim().toLowerCase()
  )
  return match?.id ?? null
}
