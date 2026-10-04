import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json } from "@/lib/supabase/database.types"
import type { DiscoverySnapshot } from "@/lib/network/discovery/contract"
import { buildDeviceFingerprint } from "@/lib/network/discovery/fingerprint"
import {
  nextCanonicalFingerprint,
  nextCanonicalOrigin,
  resolveCanonicalNetworkDevice,
  type CanonicalizationCatalog,
} from "@/lib/network/discovery/canonical-device"
import { findMatchingNetworkInterfaceId } from "@/lib/network/discovery/interface-match"

type Client = SupabaseClient<Database>
type DeviceRow = Database["public"]["Tables"]["network_devices"]["Row"]
type InterfaceRow = Database["public"]["Tables"]["network_interfaces"]["Row"]

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
  const catalog = await loadCanonicalizationCatalog(client, input.companyId)

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
      catalog,
    })
    deviceIds.set(device.localKey, row.id)
    rememberCanonicalDevice(catalog, row)

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
    rememberCanonicalInterfaces(catalog, row.id, ifaces)
  }

  let linkCount = 0
  for (const link of input.snapshot.links) {
    const fromDeviceId = deviceIds.get(link.fromLocalKey)
    const toDeviceId = deviceIds.get(link.toLocalKey)
    if (!fromDeviceId || !toDeviceId) continue

    const fromInterfaceName = link.fromInterfaceName?.trim() || null
    const fromInterfaceId = findMatchingNetworkInterfaceId(
      interfacesByDevice.get(fromDeviceId) ?? [],
      fromInterfaceName
    )
    const toInterfaceId = findMatchingNetworkInterfaceId(
      interfacesByDevice.get(toDeviceId) ?? [],
      link.toInterfaceName
    )

    await upsertNetworkLink(client, {
      companyId: input.companyId,
      fromDeviceId,
      fromInterfaceId,
      fromInterfaceName,
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

function toResolverCatalog(catalog: PersistCatalog): CanonicalizationCatalog {
  return {
    devices: catalog.devices.map((row) => ({
      id: row.id,
      fingerprint: row.fingerprint,
      origin: row.origin,
      agentId: row.agent_id,
      managementIp: row.management_ip,
      macAddress: row.mac_address,
    })),
    interfaces: catalog.interfaces.map((row) => ({
      deviceId: row.device_id,
      macAddress: row.mac_address,
    })),
  }
}

type PersistCatalog = {
  devices: DeviceRow[]
  interfaces: Array<{ device_id: string; mac_address: string | null }>
}

async function loadCanonicalizationCatalog(
  client: Client,
  companyId: string
): Promise<PersistCatalog> {
  const [devices, interfaces] = await Promise.all([
    client
      .from("network_devices")
      .select("*")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    client
      .from("network_interfaces")
      .select("device_id, mac_address")
      .eq("company_id", companyId)
      .is("deleted_at", null),
  ])
  if (devices.error) throw new Error(devices.error.message)
  if (interfaces.error) throw new Error(interfaces.error.message)
  return {
    devices: devices.data ?? [],
    interfaces: interfaces.data ?? [],
  }
}

function rememberCanonicalDevice(catalog: PersistCatalog, row: DeviceRow) {
  const index = catalog.devices.findIndex((item) => item.id === row.id)
  if (index >= 0) catalog.devices[index] = row
  else catalog.devices.push(row)
}

function rememberCanonicalInterfaces(
  catalog: PersistCatalog,
  deviceId: string,
  ifaces: InterfaceRow[]
) {
  catalog.interfaces = catalog.interfaces.filter((item) => item.device_id !== deviceId)
  for (const iface of ifaces) {
    catalog.interfaces.push({
      device_id: deviceId,
      mac_address: iface.mac_address,
    })
  }
}

async function readNetworkDevice(
  client: Client,
  companyId: string,
  deviceId: string
): Promise<DeviceRow | null> {
  const { data, error } = await client
    .from("network_devices")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", deviceId)
    .is("deleted_at", null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
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
    catalog: PersistCatalog
  }
): Promise<DeviceRow> {
  const resolution = resolveCanonicalNetworkDevice({
    fingerprint: input.fingerprint,
    snapshotOrigin: input.device.origin,
    agentId: input.agentId,
    macAddress: input.device.macAddress,
    managementIp: input.device.managementIp,
    catalog: toResolverCatalog(input.catalog),
  })

  if (resolution.action === "insert" && resolution.reason === "conflict") {
    console.warn("[Network] canonicalization conflict; inserting instead of merging", {
      fingerprint: input.fingerprint,
      origin: input.device.origin,
    })
  }

  const existing =
    resolution.action === "reuse"
      ? input.catalog.devices.find((row) => row.id === resolution.deviceId) ??
        (await readNetworkDevice(client, input.companyId, resolution.deviceId))
      : null

  const keepDiscoveryIdentity =
    existing != null &&
    existing.origin === "discovery" &&
    input.device.origin === "neighbor"

  const nextFingerprint = existing
    ? nextCanonicalFingerprint({
        existingFingerprint: existing.fingerprint,
        snapshotFingerprint: input.fingerprint,
        catalog: toResolverCatalog(input.catalog),
        deviceId: existing.id,
      })
    : input.fingerprint

  const patch = {
    agent_id: input.agentId,
    site_id: input.siteId ?? existing?.site_id ?? null,
    hostname: input.device.hostname ?? existing?.hostname ?? null,
    manufacturer: input.device.manufacturer ?? existing?.manufacturer ?? null,
    model: input.device.model ?? existing?.model ?? null,
    serial_number: input.device.serialNumber ?? existing?.serial_number ?? null,
    device_type:
      keepDiscoveryIdentity && existing
        ? existing.device_type
        : input.device.deviceType,
    management_ip:
      keepDiscoveryIdentity && existing
        ? existing.management_ip
        : input.device.managementIp ?? existing?.management_ip ?? null,
    mac_address:
      keepDiscoveryIdentity && existing
        ? existing.mac_address
        : input.device.macAddress ?? existing?.mac_address ?? null,
    firmware_version:
      input.device.firmwareVersion ?? existing?.firmware_version ?? null,
    status:
      keepDiscoveryIdentity && existing ? existing.status : input.device.status,
    origin: existing
      ? nextCanonicalOrigin(existing.origin, input.device.origin)
      : input.device.origin,
    last_seen_at: input.seenAt,
    fingerprint: nextFingerprint,
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
    fromInterfaceName: string | null
    toDeviceId: string
    toInterfaceId: string | null
    protocol: string | null
    seenAt: string
  }
): Promise<void> {
  const existing = await findExistingNetworkLink(client, input)
  if (existing) {
    const { error } = await client
      .from("network_links")
      .update({
        from_interface_id: input.fromInterfaceId,
        from_interface_name: input.fromInterfaceName,
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
    from_interface_name: input.fromInterfaceName,
    to_device_id: input.toDeviceId,
    to_interface_id: input.toInterfaceId,
    protocol: input.protocol,
    last_seen_at: input.seenAt,
  })
  if (error) {
    throw new Error(error.message)
  }
}

async function findExistingNetworkLink(
  client: Client,
  input: {
    companyId: string
    fromDeviceId: string
    fromInterfaceId: string | null
    toDeviceId: string
    toInterfaceId: string | null
  }
): Promise<{ id: string } | null> {
  const exact = await lookupNetworkLink(client, input)
  if (exact) return exact
  if (!input.fromInterfaceId) return null
  return lookupNetworkLink(client, {
    ...input,
    fromInterfaceId: null,
  })
}

async function lookupNetworkLink(
  client: Client,
  input: {
    companyId: string
    fromDeviceId: string
    fromInterfaceId: string | null
    toDeviceId: string
    toInterfaceId: string | null
  }
): Promise<{ id: string } | null> {
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

  const { data, error } = await query.maybeSingle()
  if (error) {
    throw new Error(error.message)
  }
  return data
}
