import assert from "node:assert/strict"
import test from "node:test"

import {
  nextCanonicalFingerprint,
  nextCanonicalOrigin,
  resolveCanonicalNetworkDevice,
} from "../lib/network/discovery/canonical-device.ts"
import { buildDeviceFingerprint } from "../lib/network/discovery/fingerprint.ts"
import { persistDiscoverySnapshot } from "../lib/network/discovery/persist-snapshot.ts"
import { isManagedNetworkDevice } from "../lib/network/devices/managed.ts"

const COMPANY = "co-1"
const AGENT = "ag-1"

function catalog(devices = [], interfaces = []) {
  return { devices, interfaces }
}

function deviceRow(partial) {
  return {
    id: partial.id,
    fingerprint: partial.fingerprint,
    origin: partial.origin ?? "neighbor",
    agentId: partial.agentId ?? AGENT,
    managementIp: partial.managementIp ?? null,
    macAddress: partial.macAddress ?? null,
  }
}

function matches(row, filters) {
  return filters.every((filter) => {
    const value = row[filter.col]
    if (filter.op === "is") return value === filter.val
    return value === filter.val
  })
}

function createMemoryClient(seed = {}) {
  const db = {
    network_devices: [...(seed.devices ?? [])],
    network_interfaces: [...(seed.interfaces ?? [])],
    network_links: [...(seed.links ?? [])],
  }
  let seq = 1

  function from(table) {
    if (!db[table]) db[table] = []
    const state = {
      table,
      type: "select",
      patch: null,
      row: null,
      filters: [],
    }
    const chain = {
      select() {
        return chain
      },
      eq(col, val) {
        state.filters.push({ op: "eq", col, val })
        return chain
      },
      is(col, val) {
        state.filters.push({ op: "is", col, val })
        return chain
      },
      update(patch) {
        state.type = "update"
        state.patch = patch
        state.filters = []
        return chain
      },
      insert(row) {
        state.type = "insert"
        state.row = row
        return chain
      },
      maybeSingle() {
        return execute("maybeSingle")
      },
      single() {
        return execute("single")
      },
      then(resolve, reject) {
        return execute("many").then(resolve, reject)
      },
    }

    async function execute(mode) {
      const rows = db[table]
      if (state.type === "select") {
        const found = rows.filter((row) => matches(row, state.filters))
        if (mode === "maybeSingle" || mode === "single") {
          return { data: found[0] ?? null, error: null }
        }
        return { data: found, error: null }
      }
      if (state.type === "update") {
        const matched = rows.filter((row) => matches(row, state.filters))
        for (const row of matched) Object.assign(row, state.patch)
        if (mode === "maybeSingle" || mode === "single") {
          return { data: matched[0] ?? null, error: null }
        }
        return { data: matched, error: null }
      }
      if (state.type === "insert") {
        if (table === "network_devices") {
          const exists = rows.some(
            (row) =>
              row.fingerprint === state.row.fingerprint && row.deleted_at == null
          )
          if (exists) {
            return {
              data: null,
              error: { code: "23505", message: "duplicate key value" },
            }
          }
        }
        const inserted = { id: `row-${seq++}`, deleted_at: null, ...state.row }
        rows.push(inserted)
        if (mode === "maybeSingle" || mode === "single") {
          return { data: inserted, error: null }
        }
        return { data: [inserted], error: null }
      }
      return { data: null, error: null }
    }

    return chain
  }

  return { from, db }
}

function neighborDevice(partial) {
  return {
    localKey: partial.localKey ?? "neighbor:box",
    hostname: partial.hostname ?? "PowerBox",
    manufacturer: "MikroTik",
    model: "RB960PGS",
    serialNumber: partial.serialNumber ?? null,
    deviceType: "router",
    managementIp: partial.managementIp ?? "10.100.101.4",
    macAddress: partial.macAddress ?? "C4:AD:34:6A:93:CE",
    firmwareVersion: "7.16",
    status: "unknown",
    origin: partial.origin ?? "neighbor",
    interfaces: partial.interfaces ?? [],
  }
}

function targetDevice(partial) {
  return {
    localKey: "target",
    hostname: partial.hostname ?? "PowerBox",
    manufacturer: "MikroTik",
    model: "RB960PGS",
    serialNumber: partial.serialNumber ?? "B7DF0B316E63",
    deviceType: "router",
    managementIp: partial.managementIp ?? "10.100.101.4",
    macAddress: partial.macAddress ?? "C4:AD:34:6A:93:CE",
    firmwareVersion: "7.16",
    status: "online",
    origin: "discovery",
    interfaces: partial.interfaces ?? [],
  }
}

test("1: existing serial device + neighbor same MAC reuses the same ID", () => {
  const existing = deviceRow({
    id: "pb-serial",
    fingerprint: "serial:b7df0b316e63",
    origin: "discovery",
    macAddress: "C4:AD:34:6A:93:CE",
    managementIp: "10.100.101.4",
  })
  const fingerprint = buildDeviceFingerprint({
    macAddress: "C4:AD:34:6A:93:CE",
    managementIp: "10.100.101.4",
  })
  const result = resolveCanonicalNetworkDevice({
    fingerprint,
    snapshotOrigin: "neighbor",
    agentId: AGENT,
    macAddress: "C4:AD:34:6A:93:CE",
    managementIp: "10.100.101.4",
    catalog: catalog([existing]),
  })
  assert.equal(result.action, "reuse")
  if (result.action === "reuse") {
    assert.equal(result.deviceId, "pb-serial")
    assert.equal(result.reason, "device_mac")
  }
})

test("2: existing neighbor mac:CE + target serial/MAC reuses ID, origin y fingerprint", async () => {
  const client = createMemoryClient({
    devices: [
      {
        id: "pb-neighbor",
        company_id: COMPANY,
        agent_id: AGENT,
        fingerprint: "mac:c4:ad:34:6a:93:ce",
        origin: "neighbor",
        management_ip: "10.100.101.4",
        mac_address: "C4:AD:34:6A:93:CE",
        serial_number: null,
        hostname: "PowerBox",
        manufacturer: "MikroTik",
        model: "RB960PGS",
        device_type: "router",
        status: "unknown",
        firmware_version: "7.16",
        site_id: null,
        deleted_at: null,
      },
    ],
  })
  await persistDiscoverySnapshot(client, {
    companyId: COMPANY,
    agentId: AGENT,
    siteId: null,
    snapshot: {
      vendor: "mikrotik",
      targetId: "tgt-1",
      siteId: null,
      devices: [targetDevice({})],
      links: [],
      warnings: [],
    },
  })
  assert.equal(client.db.network_devices.length, 1)
  const row = client.db.network_devices[0]
  assert.equal(row.id, "pb-neighbor")
  assert.equal(row.origin, "discovery")
  assert.equal(row.fingerprint, "serial:b7df0b316e63")
  assert.equal(row.serial_number, "B7DF0B316E63")
})

test("3: Core snapshot link to PowerBox neighbor uses canonical PowerBox id", async () => {
  const client = createMemoryClient({
    devices: [
      {
        id: "pb-canonical",
        company_id: COMPANY,
        agent_id: AGENT,
        fingerprint: "serial:b7df0b316e63",
        origin: "discovery",
        management_ip: "10.100.101.4",
        mac_address: "C4:AD:34:6A:93:CE",
        serial_number: "B7DF0B316E63",
        hostname: "PowerBox",
        manufacturer: "MikroTik",
        model: "RB960PGS",
        device_type: "router",
        status: "online",
        firmware_version: "7.16",
        site_id: null,
        deleted_at: null,
      },
    ],
  })
  await persistDiscoverySnapshot(client, {
    companyId: COMPANY,
    agentId: AGENT,
    siteId: null,
    snapshot: {
      vendor: "mikrotik",
      targetId: "tgt-core",
      siteId: null,
      devices: [
        {
          localKey: "target",
          hostname: "Core",
          manufacturer: "MikroTik",
          model: "RB3011",
          serialNumber: "783F08845252",
          deviceType: "router",
          managementIp: "177.53.120.11",
          macAddress: "CC:2D:E0:5A:E6:F6",
          firmwareVersion: "7.16",
          status: "online",
          origin: "discovery",
          interfaces: [],
        },
        neighborDevice({ localKey: "neighbor:c4:ad:34:6a:93:ce" }),
      ],
      links: [
        {
          fromLocalKey: "target",
          fromInterfaceName: "ether3",
          toLocalKey: "neighbor:c4:ad:34:6a:93:ce",
          toInterfaceName: null,
          protocol: "mndp",
        },
      ],
      warnings: [],
    },
  })
  assert.equal(client.db.network_devices.length, 2)
  const link = client.db.network_links[0]
  assert.equal(link.to_device_id, "pb-canonical")
  assert.notEqual(link.from_device_id, "pb-canonical")
})

test("4: Core neighbor interface MAC F7 reuses canonical Core", async () => {
  const client = createMemoryClient({
    devices: [
      {
        id: "core-canonical",
        company_id: COMPANY,
        agent_id: AGENT,
        fingerprint: "serial:783f08845252",
        origin: "discovery",
        management_ip: "177.53.120.11",
        mac_address: "CC:2D:E0:5A:E6:F6",
        serial_number: "783F08845252",
        hostname: "Core",
        manufacturer: "MikroTik",
        model: "RB3011",
        device_type: "router",
        status: "online",
        firmware_version: "7.16",
        site_id: null,
        deleted_at: null,
      },
    ],
    interfaces: [
      {
        id: "if-f7",
        company_id: COMPANY,
        device_id: "core-canonical",
        name: "ether2",
        mac_address: "CC:2D:E0:5A:E6:F7",
        deleted_at: null,
      },
    ],
  })
  await persistDiscoverySnapshot(client, {
    companyId: COMPANY,
    agentId: AGENT,
    siteId: null,
    snapshot: {
      vendor: "mikrotik",
      targetId: "tgt-pb",
      siteId: null,
      devices: [
        targetDevice({ hostname: "PowerBox" }),
        {
          localKey: "neighbor:core-f7",
          hostname: "Core",
          manufacturer: "MikroTik",
          model: "RB3011",
          serialNumber: null,
          deviceType: "router",
          managementIp: "10.100.101.1",
          macAddress: "CC:2D:E0:5A:E6:F7",
          firmwareVersion: "7.16",
          status: "unknown",
          origin: "neighbor",
          interfaces: [],
        },
      ],
      links: [],
      warnings: [],
    },
  })
  const cores = client.db.network_devices.filter((row) =>
    (row.hostname || "").includes("Core")
  )
  assert.equal(cores.length, 1)
  assert.equal(cores[0].id, "core-canonical")
  assert.equal(cores[0].management_ip, "177.53.120.11")
  assert.equal(cores[0].origin, "discovery")
})

test("5: same hostname, different MAC, no serial → no merge", () => {
  const existing = deviceRow({
    id: "as6-a",
    fingerprint: "mac:cc:2d:e0:5b:80:08",
    macAddress: "CC:2D:E0:5B:80:08",
    managementIp: null,
  })
  const result = resolveCanonicalNetworkDevice({
    fingerprint: "mac:cc:2d:e0:5b:80:0a",
    snapshotOrigin: "neighbor",
    agentId: AGENT,
    macAddress: "CC:2D:E0:5B:80:0A",
    managementIp: "10.100.101.14",
    catalog: catalog([existing]),
  })
  assert.equal(result.action, "insert")
})

test("6: two candidates for the same MAC → no merge", () => {
  const result = resolveCanonicalNetworkDevice({
    fingerprint: "mac:aa:aa:aa:aa:aa:aa",
    snapshotOrigin: "neighbor",
    agentId: AGENT,
    macAddress: "AA:AA:AA:AA:AA:AA",
    catalog: catalog([
      deviceRow({
        id: "left",
        fingerprint: "serial:1",
        macAddress: "AA:AA:AA:AA:AA:AA",
      }),
      deviceRow({
        id: "right",
        fingerprint: "serial:2",
        macAddress: "AA-AA-AA-AA-AA-AA",
      }),
    ]),
  })
  assert.equal(result.action, "insert")
  if (result.action === "insert") {
    assert.equal(result.reason, "ambiguous_device_mac")
  }
})

test("7: AS6 MAC ...08 and ...0A remain two devices", () => {
  const as08 = deviceRow({
    id: "as6-08",
    fingerprint: "mac:cc:2d:e0:5b:80:08",
    macAddress: "CC:2D:E0:5B:80:08",
  })
  const as0a = resolveCanonicalNetworkDevice({
    fingerprint: "mac:cc:2d:e0:5b:80:0a",
    snapshotOrigin: "neighbor",
    agentId: AGENT,
    macAddress: "CC:2D:E0:5B:80:0A",
    catalog: catalog([as08]),
  })
  assert.equal(as0a.action, "insert")
})

test("8: CPE 10.168.1.32 without target stays unmanaged neighbor", async () => {
  const client = createMemoryClient()
  await persistDiscoverySnapshot(client, {
    companyId: COMPANY,
    agentId: AGENT,
    siteId: null,
    snapshot: {
      vendor: "mikrotik",
      targetId: "tgt-core",
      siteId: null,
      devices: [
        {
          localKey: "target",
          hostname: "Core",
          manufacturer: "MikroTik",
          model: "RB3011",
          serialNumber: "783F08845252",
          deviceType: "router",
          managementIp: "177.53.120.11",
          macAddress: "CC:2D:E0:5A:E6:F6",
          firmwareVersion: "7.16",
          status: "online",
          origin: "discovery",
          interfaces: [],
        },
        {
          localKey: "neighbor:humberto",
          hostname: "Humberto lara",
          manufacturer: "MikroTik",
          model: "hAP",
          serialNumber: null,
          deviceType: "router",
          managementIp: "10.168.1.32",
          macAddress: "74:4D:28:2B:44:C1",
          firmwareVersion: "6.49",
          status: "unknown",
          origin: "neighbor",
          interfaces: [],
        },
      ],
      links: [],
      warnings: [],
    },
  })
  const cpe = client.db.network_devices.find((row) => row.management_ip === "10.168.1.32")
  assert.ok(cpe)
  assert.equal(cpe.origin, "neighbor")
  assert.equal(
    isManagedNetworkDevice(
      {
        companyId: COMPANY,
        agentId: cpe.agent_id,
        managementIp: cpe.management_ip,
      },
      { companyId: COMPANY, agentId: AGENT, host: "177.53.120.11" }
    ),
    false
  )
})

test("9: discovery snapshot may reuse neighbor by agent_id + management_ip", () => {
  const existing = deviceRow({
    id: "pb-ip-only",
    fingerprint: "mac:00:00:00:00:00:01",
    origin: "neighbor",
    macAddress: "00:00:00:00:00:01",
    managementIp: "10.100.101.4",
  })
  const asNeighbor = resolveCanonicalNetworkDevice({
    fingerprint: "serial:b7df0b316e63",
    snapshotOrigin: "neighbor",
    agentId: AGENT,
    macAddress: "C4:AD:34:6A:93:CE",
    managementIp: "10.100.101.4",
    catalog: catalog([existing]),
  })
  assert.equal(asNeighbor.action, "insert")

  const asTarget = resolveCanonicalNetworkDevice({
    fingerprint: "serial:b7df0b316e63",
    snapshotOrigin: "discovery",
    agentId: AGENT,
    macAddress: "C4:AD:34:6A:93:CE",
    managementIp: "10.100.101.4",
    catalog: catalog([existing]),
  })
  assert.equal(asTarget.action, "reuse")
  if (asTarget.action === "reuse") {
    assert.equal(asTarget.deviceId, "pb-ip-only")
    assert.equal(asTarget.reason, "management_ip")
  }
})

test("10: exact fingerprint wins over MAC/IP fallback", () => {
  const serialDevice = deviceRow({
    id: "by-serial",
    fingerprint: "serial:abc",
    origin: "discovery",
    macAddress: "AA:AA:AA:AA:AA:AA",
    managementIp: "10.0.0.1",
  })
  const otherMac = deviceRow({
    id: "by-mac",
    fingerprint: "mac:bb:bb:bb:bb:bb:bb",
    origin: "neighbor",
    macAddress: "BB:BB:BB:BB:BB:BB",
    managementIp: "10.0.0.1",
  })
  const result = resolveCanonicalNetworkDevice({
    fingerprint: "serial:abc",
    snapshotOrigin: "discovery",
    agentId: AGENT,
    macAddress: "BB:BB:BB:BB:BB:BB",
    managementIp: "10.0.0.1",
    catalog: catalog([serialDevice, otherMac]),
  })
  assert.equal(result.action, "reuse")
  if (result.action === "reuse") {
    assert.equal(result.deviceId, "by-serial")
    assert.equal(result.reason, "fingerprint")
  }
})

test("11: MAC candidate and management_ip candidate differ → no silent merge", () => {
  const byMac = deviceRow({
    id: "device-mac",
    fingerprint: "mac:c4:ad:34:6a:93:ce",
    macAddress: "C4:AD:34:6A:93:CE",
    managementIp: "10.10.10.10",
  })
  const byIp = deviceRow({
    id: "device-ip",
    fingerprint: "mac:00:11:22:33:44:55",
    macAddress: "00:11:22:33:44:55",
    managementIp: "10.100.101.4",
  })
  const result = resolveCanonicalNetworkDevice({
    fingerprint: "serial:b7df0b316e63",
    snapshotOrigin: "discovery",
    agentId: AGENT,
    macAddress: "C4:AD:34:6A:93:CE",
    managementIp: "10.100.101.4",
    catalog: catalog([byMac, byIp]),
  })
  assert.equal(result.action, "insert")
  if (result.action === "insert") {
    assert.equal(result.reason, "conflict")
  }
})

test("origin never degrades discovery to neighbor", () => {
  assert.equal(nextCanonicalOrigin("discovery", "neighbor"), "discovery")
  assert.equal(nextCanonicalOrigin("neighbor", "discovery"), "discovery")
  assert.equal(nextCanonicalOrigin("neighbor", "neighbor"), "neighbor")
})

test("fingerprint only upgrades to unused serial:", () => {
  assert.equal(
    nextCanonicalFingerprint({
      existingFingerprint: "mac:c4:ad:34:6a:93:ce",
      snapshotFingerprint: "serial:b7df0b316e63",
      deviceId: "pb-neighbor",
      catalog: catalog([
        deviceRow({
          id: "pb-neighbor",
          fingerprint: "mac:c4:ad:34:6a:93:ce",
          macAddress: "C4:AD:34:6A:93:CE",
        }),
      ]),
    }),
    "serial:b7df0b316e63"
  )
  assert.equal(
    nextCanonicalFingerprint({
      existingFingerprint: "mac:c4:ad:34:6a:93:ce",
      snapshotFingerprint: "serial:b7df0b316e63",
      deviceId: "pb-neighbor",
      catalog: catalog([
        deviceRow({
          id: "pb-neighbor",
          fingerprint: "mac:c4:ad:34:6a:93:ce",
          macAddress: "C4:AD:34:6A:93:CE",
        }),
        deviceRow({
          id: "other",
          fingerprint: "serial:b7df0b316e63",
          macAddress: "AA:AA:AA:AA:AA:AA",
        }),
      ]),
    }),
    "mac:c4:ad:34:6a:93:ce"
  )
})
