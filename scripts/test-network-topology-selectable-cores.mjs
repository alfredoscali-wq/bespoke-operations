/**
 * El selector de Core sale de destinos de Discovery activos.
 * Los enlaces MNDP no deciden esa lista.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  pickLatestCompletedDiscoveryJobForHost,
  pickLatestCompletedDiscoveryJobForTarget,
} from "../lib/network/discovery/latest-run.ts"
import { selectTopologyRootIds } from "../lib/network/topology/local-view.ts"
import {
  collectDiscoveryJobDeviceIds,
  selectAvailableCuratedTopologyDevices,
} from "../lib/network/topology/available-devices.ts"
import { selectSelectableTopologyCores } from "../lib/network/topology/selectable-cores.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const COMPANY = "00000000-0000-4000-8000-000000000002"
const OTHER = "00000000-0000-4000-8000-000000000099"
const AGENT = "fd46448a-7b37-4e5a-b4be-bd87d6bb69c8"
const OTHER_AGENT = "aaaaaaaa-7b37-4e5a-b4be-bd87d6bb69c8"
const PILAR = "565866c7-6311-4611-9615-a1220cdcb40c"
const MALAGUENO = "834ca12a-90f2-4b98-87cf-257fe9970c58"
const PILAR_TARGET = "2dd46851-2ac0-4faa-998a-ae76b5946b56"
const MALAGUENO_TARGET = "3769f7d0-8841-48ba-b3d1-f3d41865c7ca"
const PILAR_CHILD = "pilar-child"
const PILAR_PLACED = "pilar-placed"
const MALAGUENO_CHILD = "malagueno-child"
const NEIGHBOR = "neighbor-without-target"

function device(id, overrides = {}) {
  return {
    id,
    companyId: COMPANY,
    agentId: AGENT,
    managementIp: null,
    hostname: id,
    operationalStatus: "online",
    deletedAt: null,
    ...overrides,
  }
}

const pilar = device(PILAR, {
  hostname: "RB1100x2 - Pilar",
  managementIp: "177.53.120.17",
})
const malagueno = device(MALAGUENO, {
  hostname: "RB3011 - Core Malagueno",
  managementIp: "177.53.120.11",
})

const targets = [
  { companyId: COMPANY, agentId: AGENT, host: "177.53.120.17" },
  { companyId: COMPANY, agentId: AGENT, host: "177.53.120.11" },
]

const oldAndReverseLinks = [
  { fromDeviceId: MALAGUENO, toDeviceId: PILAR },
  { fromDeviceId: PILAR, toDeviceId: MALAGUENO },
]

function coreIds() {
  return selectSelectableTopologyCores(
    [
      pilar,
      malagueno,
      device(NEIGHBOR, {
        hostname: "ALS Pilar",
        managementIp: "10.100.103.27",
      }),
      device("other-company-same-ip", {
        companyId: OTHER,
        hostname: "Pilar ajeno",
        managementIp: "177.53.120.17",
      }),
    ],
    targets
  ).map((core) => core.id)
}

test("Pilar y Malagueño aparecen ambos como Core", () => {
  assert.deepEqual(coreIds(), [PILAR, MALAGUENO])
})

test("un enlace MNDP antiguo no oculta un Core", () => {
  const hierarchy = selectTopologyRootIds(
    [PILAR, MALAGUENO],
    [{ fromDeviceId: MALAGUENO, toDeviceId: PILAR }]
  )
  assert.equal(hierarchy.includes(PILAR), false)
  assert.deepEqual(coreIds(), [PILAR, MALAGUENO])
})

test("los enlaces inversos no ocultan a ninguno de los dos", () => {
  const hierarchy = selectTopologyRootIds(
    [PILAR, MALAGUENO],
    oldAndReverseLinks
  )
  assert.equal(hierarchy.length, 1)
  assert.deepEqual(coreIds(), [PILAR, MALAGUENO])
})

test("un dispositivo sin destino activo no aparece como Core", () => {
  const withoutPilarTarget = selectSelectableTopologyCores(
    [pilar, malagueno, device(NEIGHBOR, { managementIp: "10.100.103.27" })],
    [
      { companyId: COMPANY, agentId: AGENT, host: "177.53.120.11" },
      {
        companyId: COMPANY,
        agentId: AGENT,
        host: "177.53.120.17",
        deletedAt: "2026-11-26T23:00:00.000Z",
      },
    ]
  )
  assert.deepEqual(
    withoutPilarTarget.map((core) => core.id),
    [MALAGUENO]
  )
  assert.equal(
    selectSelectableTopologyCores(
      [device("wrong-agent", { managementIp: "177.53.120.17", agentId: OTHER_AGENT })],
      targets
    ).length,
    0
  )
  assert.equal(
    selectSelectableTopologyCores(
      [device(PILAR, { managementIp: "177.53.120.17", deletedAt: "2026-11-01T00:00:00.000Z" })],
      targets
    ).length,
    0
  )
})

test("cada Core usa su propio Discovery y conserva los ya ubicados", () => {
  const jobs = [
    {
      id: "job-malagueno",
      status: "completed",
      agentId: AGENT,
      startedAt: "2026-10-04T02:34:55.000Z",
      completedAt: "2026-10-04T02:35:35.000Z",
      payload: { targetId: MALAGUENO_TARGET, host: "177.53.120.11" },
      result: { targetId: MALAGUENO_TARGET, primaryManagementIp: "177.53.120.11" },
    },
    {
      id: "job-pilar",
      status: "completed",
      agentId: AGENT,
      startedAt: "2026-11-26T23:41:32.814Z",
      completedAt: "2026-11-26T23:42:09.545Z",
      payload: { targetId: PILAR_TARGET, host: "177.53.120.17" },
      result: { targetId: PILAR_TARGET, primaryManagementIp: "177.53.120.17" },
    },
  ]
  const pilarJob = pickLatestCompletedDiscoveryJobForTarget(jobs, PILAR_TARGET)
  const malaguenoJob = pickLatestCompletedDiscoveryJobForTarget(jobs, MALAGUENO_TARGET)
  assert.equal(pilarJob.id, "job-pilar")
  assert.equal(malaguenoJob.id, "job-malagueno")
  assert.equal(
    pickLatestCompletedDiscoveryJobForHost(jobs, "177.53.120.17").id,
    "job-pilar"
  )
  assert.equal(
    pickLatestCompletedDiscoveryJobForHost(jobs, "177.53.120.11").id,
    "job-malagueno"
  )

  const rows = [
    device(PILAR, { hostname: "RB1100x2 - Pilar", managementIp: "177.53.120.17" }),
    device(PILAR_CHILD, { hostname: "Radio Pilar", managementIp: "10.100.103.27" }),
    device(PILAR_PLACED, { hostname: "Switch Pilar", managementIp: "10.100.103.28" }),
    device(MALAGUENO, { hostname: "RB3011 - Core Malagueno", managementIp: "177.53.120.11" }),
    device(MALAGUENO_CHILD, { hostname: "Radio Malagueño", managementIp: "10.100.101.4" }),
    device("foreign-child", {
      companyId: OTHER,
      hostname: "Ajeno",
      managementIp: "10.9.9.9",
    }),
  ]
  const pilarSeen = collectDiscoveryJobDeviceIds({
    job: pilarJob,
    devices: [
      { id: PILAR, lastSeenAt: "2026-11-26T23:41:34.081Z" },
      { id: PILAR_CHILD, lastSeenAt: "2026-11-26T23:41:34.081Z" },
      { id: PILAR_PLACED, lastSeenAt: "2026-11-26T23:41:34.081Z" },
      { id: MALAGUENO_CHILD, lastSeenAt: "2026-10-04T02:35:03.376Z" },
      { id: "foreign-child", lastSeenAt: "2026-11-26T23:41:34.081Z" },
    ],
    links: [
      {
        fromDeviceId: PILAR,
        toDeviceId: PILAR_CHILD,
        lastSeenAt: "2026-11-26T23:41:34.081Z",
      },
      {
        fromDeviceId: MALAGUENO,
        toDeviceId: MALAGUENO_CHILD,
        lastSeenAt: "2026-10-04T02:35:03.376Z",
      },
    ],
  })
  const malaguenoSeen = collectDiscoveryJobDeviceIds({
    job: malaguenoJob,
    devices: [
      { id: MALAGUENO, lastSeenAt: "2026-10-04T02:35:03.376Z" },
      { id: MALAGUENO_CHILD, lastSeenAt: "2026-10-04T02:35:03.376Z" },
      { id: PILAR_CHILD, lastSeenAt: "2026-11-26T23:41:34.081Z" },
    ],
    links: [
      {
        fromDeviceId: MALAGUENO,
        toDeviceId: MALAGUENO_CHILD,
        lastSeenAt: "2026-10-04T02:35:03.376Z",
      },
    ],
  })

  const pilarAvailable = selectAvailableCuratedTopologyDevices({
    companyId: COMPANY,
    coreDeviceId: PILAR,
    discoveredDeviceIds: pilarSeen,
    devices: rows,
    placements: [
      { companyId: COMPANY, deviceId: PILAR, deletedAt: null },
      { companyId: COMPANY, deviceId: PILAR_PLACED, deletedAt: null },
    ],
  }).map((item) => item.id)
  const malaguenoAvailable = selectAvailableCuratedTopologyDevices({
    companyId: COMPANY,
    coreDeviceId: MALAGUENO,
    discoveredDeviceIds: malaguenoSeen,
    devices: rows,
    placements: [{ companyId: COMPANY, deviceId: MALAGUENO, deletedAt: null }],
  }).map((item) => item.id)

  assert.deepEqual(pilarAvailable, [PILAR_CHILD])
  assert.deepEqual(malaguenoAvailable, [MALAGUENO_CHILD])
  assert.equal(pilarAvailable.includes(MALAGUENO_CHILD), false)
  assert.equal(malaguenoAvailable.includes(PILAR_CHILD), false)
  assert.equal(pilarAvailable.includes("foreign-child"), false)
})

test("el selector de la página no usa la jerarquía MNDP", () => {
  const queries = read("lib/network/topology/queries.ts")
  const page = queries.slice(
    queries.indexOf("export async function getNetworkTopologyPage"),
    queries.indexOf("function toLocalTopologyLinks")
  )
  const coresAssign = page.slice(
    page.indexOf("const cores = selectSelectableTopologyCores"),
    page.indexOf("const selected =")
  )
  const selector = read("lib/network/topology/selectable-cores.ts")
  assert.match(coresAssign, /discoveryTargets/)
  assert.doesNotMatch(coresAssign, /rootIds|directedLinks|selectTopologyRootIds/)
  assert.match(page, /selectTopologyRootIds\(managedIdList, directedLinks\)/)
  assert.match(page, /excludedFromNested/)
  assert.match(selector, /isManagedNetworkDevice/)
  assert.doesNotMatch(selector, /selectTopologyRootIds|listManagedParentIds|network_links/)
  assert.match(
    page.slice(page.indexOf("const latest ="), page.indexOf("const statuses")),
    /byHost\.get\(selected\.managementIp\)/
  )
})
