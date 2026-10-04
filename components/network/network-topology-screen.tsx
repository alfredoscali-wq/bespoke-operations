"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"

import { CuratedTopologyEditor } from "@/components/network/curated-topology-editor"
import { NetworkSubnav } from "@/components/network/network-subnav"
import { NetworkTopologyManageDialog } from "@/components/network/network-topology-manage-dialog"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  NETWORK_DEVICE_STATUS_LABELS,
  NETWORK_DEVICE_STATUS_TONES,
  NETWORK_DEVICE_TYPE_LABELS,
  NETWORK_JOB_STATUS_LABELS,
  formatNetworkTimestamp,
} from "@/lib/network/labels"
import {
  networkManagementVendorLabel,
  resolveNetworkManagementVendor,
} from "@/lib/network/management/vendor"
import { networkQueryKeys } from "@/lib/network/react-query/keys"
import { useNetworkDevicesQuery } from "@/lib/network/react-query/use-network-devices-query"
import { useNetworkTopologyQuery } from "@/lib/network/react-query/use-network-topology-query"
import {
  buildTopologyEdgeDetail,
  formatTopologyNodeIdentity,
  formatTopologyPeerLink,
  resolveTopologySelection,
  topologyManagedDeviceHref,
  type TopologySelection,
} from "@/lib/network/topology/graph"
import { buildObservedDeviceManagementState } from "@/lib/network/topology/management-state"
import { postNetworkDeviceManage } from "@/lib/network/topology/manage-request"
import type {
  CuratedTopologyForest,
  CuratedTopologyNode,
  LocalCoreTopologyView,
  LocalTopologyInterfaceGroup,
  LocalTopologyObservedDevice,
  NetworkTopologyEdge,
  NetworkTopologyManagementJob,
  NetworkTopologyManagementTarget,
  NetworkTopologyNode,
} from "@/lib/network/topology/types"
import type { NetworkDevice } from "@/lib/network/types"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

const CANVAS_WIDTH = 920
const CANVAS_HEIGHT = 520

function layoutNodes(nodes: NetworkTopologyNode[]) {
  if (nodes.length === 0) return []
  if (nodes.length === 1) {
    return [{ ...nodes[0], x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 }]
  }
  const cx = CANVAS_WIDTH / 2
  const cy = CANVAS_HEIGHT / 2
  const radius = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.34
  return nodes.map((node, index) => {
    const angle = (2 * Math.PI * index) / nodes.length - Math.PI / 2
    return {
      ...node,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    }
  })
}

function nodeFill(node: NetworkTopologyNode): string {
  if (node.kind === "neighbor") return "#f8fafc"
  if (node.operationalStatus === "online") return "#dcfce7"
  if (node.operationalStatus === "offline") return "#fee2e2"
  if (node.operationalStatus === "degraded") return "#fef3c7"
  return "#e2e8f0"
}

function nodeStroke(node: NetworkTopologyNode): string {
  if (node.kind === "neighbor") return "#94a3b8"
  if (node.operationalStatus === "online") return "#16a34a"
  if (node.operationalStatus === "offline") return "#dc2626"
  if (node.operationalStatus === "degraded") return "#d97706"
  return "#64748b"
}

function statusDotClass(status: string | null | undefined): string {
  if (status === "online") return "bg-emerald-500"
  if (status === "offline") return "bg-red-500"
  if (status === "degraded") return "bg-amber-500"
  return "bg-slate-400"
}

function monitoringLabel(status: string | null | undefined): string {
  if (
    status === "online" ||
    status === "offline" ||
    status === "degraded" ||
    status === "unknown"
  ) {
    return NETWORK_DEVICE_STATUS_LABELS[status]
  }
  return "Sin monitoreo"
}

function collectObservedDevices(
  groups: readonly LocalTopologyInterfaceGroup[]
): Map<string, LocalTopologyObservedDevice> {
  const map = new Map<string, LocalTopologyObservedDevice>()
  function walk(items: readonly LocalTopologyInterfaceGroup[]) {
    for (const group of items) {
      for (const device of [...group.devices, ...group.cpes]) {
        map.set(device.id, device)
        if (device.downstream.length > 0) walk(device.downstream)
      }
    }
  }
  walk(groups)
  return map
}

function findCuratedNode(
  forest: CuratedTopologyForest | null,
  deviceId: string
): CuratedTopologyNode | null {
  if (!forest) return null
  const stack = [...forest.roots]
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node) continue
    if (node.deviceId === deviceId) return node
    stack.push(...node.children)
  }
  return null
}

function toObservedDeviceFromInventory(input: {
  deviceId: string
  inventory: NetworkDevice | null
  graphNode: NetworkTopologyNode | null
  curatedNode: CuratedTopologyNode | null
  managed: boolean
}): LocalTopologyObservedDevice {
  const { inventory, graphNode, curatedNode, managed, deviceId } = input
  return {
    id: deviceId,
    hostname:
      inventory?.hostname ?? graphNode?.hostname ?? curatedNode?.hostname ?? null,
    managementIp:
      inventory?.managementIp ??
      graphNode?.managementIp ??
      curatedNode?.ipAddress ??
      null,
    macAddress: inventory?.macAddress ?? null,
    platform: inventory?.manufacturer ?? null,
    board: inventory?.model ?? null,
    version: inventory?.firmwareVersion ?? null,
    discoveredBy: null,
    origin: inventory?.origin ?? graphNode?.origin ?? null,
    observedInterfaceName: null,
    lastSeenAt: inventory?.lastSeenAt ?? null,
    deviceType: inventory?.deviceType ?? graphNode?.deviceType ?? null,
    operationalStatus:
      inventory?.operationalStatus ??
      graphNode?.operationalStatus ??
      curatedNode?.status ??
      null,
    lastPollAt: inventory?.lastPollAt ?? graphNode?.lastPollAt ?? null,
    managed,
    downstream: [],
    agentId: inventory?.agentId ?? graphNode?.agentId ?? null,
    observations: [],
  }
}

function managementStateForDevice(
  jobs: readonly NetworkTopologyManagementJob[],
  targets: readonly NetworkTopologyManagementTarget[],
  device: LocalTopologyObservedDevice
) {
  return buildObservedDeviceManagementState({
    managed: device.managed,
    agentId: device.agentId,
    deviceId: device.id,
    managementIp: device.managementIp,
    jobs,
    targets,
  })
}

export function NetworkTopologyScreen() {
  const queryClient = useQueryClient()
  const [selectedCoreId, setSelectedCoreId] = useState<string | null>(null)
  const { data, error, isPending } = useNetworkTopologyQuery(selectedCoreId)
  const { data: inventoryDevices = [] } = useNetworkDevicesQuery()
  const [selection, setSelection] = useState<TopologySelection | null>(null)
  const [observedId, setObservedId] = useState<string | null>(null)
  const [cpeGroupKey, setCpeGroupKey] = useState<string | null>(null)
  const [curatedDeviceId, setCuratedDeviceId] = useState<string | null>(null)
  const [manageOpen, setManageOpen] = useState(false)
  const [manageMode, setManageMode] = useState<"administer" | "replace">(
    "administer"
  )
  const [manageBusy, setManageBusy] = useState<"test" | "discover" | null>(null)
  const [manageError, setManageError] = useState<string | null>(null)
  const graph = data?.graph ?? { nodes: [], edges: [] }
  const cores = data?.cores ?? []
  const local = data?.local ?? null
  const curated = data?.curated ?? null
  const discoveryJobs = data?.discoveryJobs ?? []
  const managementTargets = data?.managementTargets ?? []
  const activeCoreId =
    selectedCoreId && cores.some((core) => core.id === selectedCoreId)
      ? selectedCoreId
      : (cores[0]?.id ?? null)
  const activeSelection = resolveTopologySelection(
    selection,
    graph.nodes,
    graph.edges
  )
  const positioned = useMemo(() => layoutNodes(graph.nodes), [graph.nodes])
  const byId = useMemo(
    () => new Map(positioned.map((node) => [node.id, node])),
    [positioned]
  )
  const observedById = useMemo(
    () => collectObservedDevices(local?.interfaceGroups ?? []),
    [local]
  )
  const selectedCpeGroup =
    cpeGroupKey != null
      ? (local?.interfaceGroups.find(
          (group) => (group.interfaceName ?? "") === cpeGroupKey
        ) ?? null)
      : null
  const selectedObserved = observedId ? (observedById.get(observedId) ?? null) : null
  const selectedCuratedDevice = useMemo(() => {
    if (!curatedDeviceId) return null
    const inventory =
      inventoryDevices.find((device) => device.id === curatedDeviceId) ?? null
    const graphNode =
      graph.nodes.find((node) => node.id === curatedDeviceId) ?? null
    const curatedNode = findCuratedNode(curated, curatedDeviceId)
    if (!inventory && !graphNode && !curatedNode) return null
    const host = (inventory?.managementIp ?? graphNode?.managementIp ?? "").trim()
    const agentId = (inventory?.agentId ?? graphNode?.agentId ?? "").trim()
    const managed =
      graphNode?.kind === "managed" ||
      (host !== "" &&
        agentId !== "" &&
        managementTargets.some(
          (target) => target.agentId === agentId && target.host.trim() === host
        ))
    return toObservedDeviceFromInventory({
      deviceId: curatedDeviceId,
      inventory,
      graphNode,
      curatedNode,
      managed,
    })
  }, [
    curatedDeviceId,
    inventoryDevices,
    graph.nodes,
    curated,
    managementTargets,
  ])
  const selectedDetailDevice = selectedCuratedDevice ?? selectedObserved
  const selectedNode =
    !selectedDetailDevice && !selectedCpeGroup && activeSelection?.kind === "node"
      ? (byId.get(activeSelection.id) ??
          graph.nodes.find((node) => node.id === activeSelection.id) ??
          null)
      : null
  const selectedEdge =
    !selectedDetailDevice && !selectedCpeGroup && activeSelection?.kind === "edge"
      ? (graph.edges.find((edge) => edge.id === activeSelection.id) ?? null)
      : null
  const relatedEdges = useMemo(
    () =>
      selectedNode
        ? graph.edges.filter(
            (edge) =>
              edge.sourceDeviceId === selectedNode.id ||
              edge.targetDeviceId === selectedNode.id
          )
        : [],
    [graph.edges, selectedNode]
  )

  const loadError =
    error instanceof Error
      ? error.message
      : error
        ? "No se pudo cargar la topología."
        : null

  function clearLocalSelection() {
    setObservedId(null)
    setCpeGroupKey(null)
    setCuratedDeviceId(null)
  }

  function selectCuratedDevice(deviceId: string) {
    setObservedId(null)
    setCpeGroupKey(null)
    setSelection(null)
    setCuratedDeviceId(deviceId)
  }

  function selectCoreNode(coreId: string) {
    clearLocalSelection()
    setSelection({ kind: "node", id: coreId })
  }

  function selectObserved(deviceId: string) {
    setSelection(null)
    setCpeGroupKey(null)
    setCuratedDeviceId(null)
    setObservedId(deviceId)
  }

  function selectCpeGroup(interfaceName: string | null) {
    setSelection(null)
    setObservedId(null)
    setCuratedDeviceId(null)
    setCpeGroupKey(interfaceName ?? "")
  }

  async function postManagedAction(intent: "test" | "discover") {
    if (!selectedDetailDevice || manageBusy) return
    setManageBusy(intent)
    setManageError(null)
    try {
      const result = await postNetworkDeviceManage({
        deviceId: selectedDetailDevice.id,
        intent,
        agentId: selectedDetailDevice.agentId,
        password: "",
      })
      if (!result.job) {
        throw new Error("No se pudo administrar el dispositivo.")
      }
      void queryClient.invalidateQueries({
        queryKey: networkQueryKeys.topology(),
      })
    } catch (actionError) {
      setManageError(
        actionError instanceof Error
          ? actionError.message
          : "No se pudo administrar el dispositivo."
      )
    } finally {
      setManageBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Topología</h1>
        <p className="text-sm text-muted-foreground">
          Infraestructura local del Core seleccionado, agrupada por interfaz.
        </p>
        <NetworkSubnav current="topology" />
      </div>

      {cores.length > 0 ? (
        <label className="block w-fit space-y-1 text-sm">
          <span className="text-muted-foreground">Core</span>
          <select
            className="block h-9 min-w-64 rounded-md border bg-background px-3"
            value={activeCoreId ?? ""}
            onChange={(event) => {
              setSelectedCoreId(event.target.value)
              selectCoreNode(event.target.value)
            }}
          >
            {cores.map((core) => (
              <option key={core.id} value={core.id}>
                {core.hostname || core.managementIp || core.id}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {loadError && !data ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-h-[32rem] overflow-auto rounded-lg border bg-card">
          {isPending && graph.nodes.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Cargando topología…</p>
          ) : (
            <CuratedTopologyEditor
              forest={curated ?? { roots: [] }}
              selectedDeviceId={curatedDeviceId}
              onSelectDevice={selectCuratedDevice}
            />
          )}
          {false ? (
            <svg
              viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
              className="h-[520px] w-full"
              role="img"
              aria-label="Topología de red"
            >
              <rect
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                fill="transparent"
                onClick={() => {
                  clearLocalSelection()
                  setSelection(null)
                }}
              />
              {graph.edges.map((edge) => {
                const source = byId.get(edge.sourceDeviceId)
                const target = byId.get(edge.targetDeviceId)
                if (!source || !target) return null
                const mx = (source.x + target.x) / 2
                const my = (source.y + target.y) / 2
                const active =
                  activeSelection?.kind === "edge" && activeSelection.id === edge.id
                return (
                  <g
                    key={edge.id}
                    className="cursor-pointer"
                    onClick={(event) => {
                      event.stopPropagation()
                      clearLocalSelection()
                      setSelection({ kind: "edge", id: edge.id })
                    }}
                  >
                    <line
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke="transparent"
                      strokeWidth={12}
                    />
                    <line
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={active ? "#0f172a" : "#94a3b8"}
                      strokeWidth={active ? 3 : 1.5}
                    />
                    <text
                      x={mx}
                      y={my - 8}
                      textAnchor="middle"
                      className="fill-muted-foreground"
                      fontSize="11"
                    >
                      {edge.label}
                    </text>
                  </g>
                )
              })}
              {positioned.map((node) => (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={(event) => {
                    event.stopPropagation()
                    selectCoreNode(node.id)
                  }}
                  className="cursor-pointer"
                >
                  <circle
                    r={
                      activeSelection?.kind === "node" &&
                      activeSelection.id === node.id
                        ? 22
                        : 18
                    }
                    fill={nodeFill(node)}
                    stroke={nodeStroke(node)}
                    strokeWidth={
                      activeSelection?.kind === "node" &&
                      activeSelection.id === node.id
                        ? 3
                        : 2
                    }
                    strokeDasharray={node.kind === "neighbor" ? "4 3" : undefined}
                  />
                  <text
                    y={36}
                    textAnchor="middle"
                    className="fill-foreground"
                    fontSize="12"
                    fontWeight={600}
                  >
                    {node.hostname || node.managementIp || "Sin nombre"}
                  </text>
                  {node.managementIp ? (
                    <text
                      y={50}
                      textAnchor="middle"
                      className="fill-muted-foreground"
                      fontSize="10"
                    >
                      {node.managementIp}
                    </text>
                  ) : null}
                </g>
              ))}
            </svg>
          ) : null}
        </div>

        <aside className="max-h-[32rem] overflow-y-auto rounded-lg border bg-card p-4 text-sm">
          {selectedDetailDevice ? (
            <SelectedObservedPanel
              key={selectedDetailDevice.id}
              device={selectedDetailDevice}
              agentName={
                inventoryDevices.find(
                  (item) => item.id === selectedDetailDevice.id
                )?.agentName ?? null
              }
              state={managementStateForDevice(
                discoveryJobs,
                managementTargets,
                selectedDetailDevice
              )}
              busy={manageBusy}
              actionError={manageError}
              onClose={() => {
                setObservedId(null)
                setCuratedDeviceId(null)
              }}
              onAdminister={() => {
                setManageMode("administer")
                setManageOpen(true)
              }}
              onReplace={() => {
                setManageMode("replace")
                setManageOpen(true)
              }}
              onTest={() => void postManagedAction("test")}
              onDiscover={() => void postManagedAction("discover")}
            />
          ) : selectedCpeGroup ? (
            <SelectedCpeGroupPanel
              group={selectedCpeGroup}
              onClose={() => setCpeGroupKey(null)}
              onSelectObserved={selectObserved}
            />
          ) : selectedNode ? (
            <SelectedNodePanel
              node={selectedNode}
              edges={relatedEdges}
              nodesById={byId}
              onClose={() => setSelection(null)}
              onSelectEdge={(edgeId) => {
                clearLocalSelection()
                setSelection({ kind: "edge", id: edgeId })
              }}
            />
          ) : selectedEdge ? (
            <SelectedEdgePanel
              edge={selectedEdge}
              nodesById={byId}
              onClose={() => setSelection(null)}
            />
          ) : (
            <p className="text-muted-foreground">
              Seleccioná un dispositivo
            </p>
          )}
        </aside>
      </div>
      <NetworkTopologyManageDialog
        open={manageOpen}
        device={selectedDetailDevice}
        agentId={selectedDetailDevice?.agentId ?? null}
        mode={manageMode}
        onOpenChange={setManageOpen}
        onStarted={() => {
          void queryClient.invalidateQueries({
            queryKey: networkQueryKeys.topology(),
          })
        }}
        onReplaced={() => {
          void queryClient.invalidateQueries({
            queryKey: networkQueryKeys.topology(),
          })
        }}
      />
    </div>
  )
}

function LocalCoreTree({
  local,
  selectedCoreId,
  selectedObservedId,
  selectedCpeGroupKey,
  onSelectCore,
  onSelectObserved,
  onSelectCpeGroup,
}: {
  local: LocalCoreTopologyView
  selectedCoreId: string | null
  selectedObservedId: string | null
  selectedCpeGroupKey: string | null
  onSelectCore: () => void
  onSelectObserved: (deviceId: string) => void
  onSelectCpeGroup: (interfaceName: string | null) => void
}) {
  const coreSelected = selectedCoreId === local.core.id
  return (
    <div className="min-w-max p-6">
      <div className="flex flex-col items-center">
        <button
          type="button"
          className={cn(
            "w-[280px] rounded-xl border bg-background px-5 py-4 text-left shadow-sm",
            coreSelected ? "border-foreground ring-2 ring-foreground/20" : "hover:border-foreground/40"
          )}
          onClick={onSelectCore}
        >
          <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">
            CORE
          </p>
          <p className="mt-2 text-base font-semibold leading-tight">
            {local.core.hostname || local.core.managementIp || "Core"}
          </p>
          {local.core.managementIp ? (
            <p className="mt-1 text-sm text-muted-foreground">{local.core.managementIp}</p>
          ) : null}
          <p className="mt-3 flex items-center gap-2 text-sm">
            <span
              className={cn(
                "inline-block size-2.5 rounded-full",
                statusDotClass(local.core.operationalStatus)
              )}
            />
            {monitoringLabel(local.core.operationalStatus)}
          </p>
        </button>

        {local.interfaceGroups.length === 0 ? (
          <p className="mt-8 max-w-sm text-center text-sm text-muted-foreground">
            No hay infraestructura LAN/VLAN en el último discovery de este Core.
          </p>
        ) : (
          <>
            <div className="h-8 w-px bg-border" />
            <div className="flex items-start gap-5">
              {local.interfaceGroups.map((group) => (
                <InterfaceBranch
                  key={group.interfaceName ?? "sin-interfaz"}
                  group={group}
                  selectedObservedId={selectedObservedId}
                  cpeSelected={selectedCpeGroupKey === (group.interfaceName ?? "")}
                  onSelectObserved={onSelectObserved}
                  onSelectCpeGroup={() => onSelectCpeGroup(group.interfaceName)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function InterfaceBranch({
  group,
  selectedObservedId,
  cpeSelected,
  onSelectObserved,
  onSelectCpeGroup,
}: {
  group: LocalTopologyInterfaceGroup
  selectedObservedId: string | null
  cpeSelected: boolean
  onSelectObserved: (deviceId: string) => void
  onSelectCpeGroup: () => void
}) {
  return (
    <div className="flex min-w-[200px] flex-col items-center">
      <div className="h-6 w-px bg-border" />
      <div className="rounded-full border bg-muted/60 px-3 py-1 text-center text-xs font-medium">
        {group.interfaceLabel}
      </div>
      <div className="h-4 w-px bg-border" />
      <div className="flex w-full flex-col gap-2">
        {group.devices.map((device) => (
          <div key={device.id} className="flex flex-col items-center gap-2">
            <button
              type="button"
              className={cn(
                "w-full rounded-lg border bg-background px-3 py-2 text-left shadow-sm",
                selectedObservedId === device.id
                  ? "border-foreground ring-2 ring-foreground/20"
                  : "hover:border-foreground/40"
              )}
              onClick={() => onSelectObserved(device.id)}
            >
              <p className="truncate text-sm font-medium">
                {device.hostname || device.managementIp || device.id}
              </p>
              {device.managementIp ? (
                <p className="truncate text-xs text-muted-foreground">
                  {device.managementIp}
                </p>
              ) : null}
              <p className="mt-1 text-[11px] font-medium">
                {device.managed ? "🟢 Administrado" : "⚪ No administrado"}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span
                  className={cn(
                    "inline-block size-1.5 rounded-full",
                    statusDotClass(device.operationalStatus)
                  )}
                />
                {device.operationalStatus
                  ? monitoringLabel(device.operationalStatus)
                  : "⚪ Sin monitoreo"}
              </p>
            </button>
            {device.downstream.length > 0 ? (
              <div className="flex items-start gap-3">
                {device.downstream.map((nested) => (
                  <InterfaceBranch
                    key={`${device.id}-${nested.interfaceName ?? "sin-interfaz"}`}
                    group={nested}
                    selectedObservedId={selectedObservedId}
                    cpeSelected={false}
                    onSelectObserved={onSelectObserved}
                    onSelectCpeGroup={onSelectCpeGroup}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {group.cpeCount > 0 ? (
          <button
            type="button"
            className={cn(
              "w-full rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-left",
              cpeSelected ? "border-foreground ring-2 ring-foreground/20" : "hover:border-foreground/40"
            )}
            onClick={onSelectCpeGroup}
          >
            <p className="text-sm font-medium">CPE</p>
            <p className="text-xs text-muted-foreground">
              {group.cpeCount} observados
            </p>
          </button>
        ) : null}
      </div>
    </div>
  )
}

function SelectedCpeGroupPanel({
  group,
  onClose,
  onSelectObserved,
}: {
  group: LocalTopologyInterfaceGroup
  onClose: () => void
  onSelectObserved: (deviceId: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          CPE observados
        </p>
        <PanelCloseButton onClose={onClose} />
      </div>
      <div>
        <p className="text-base font-medium">{group.interfaceLabel}</p>
        <p className="text-muted-foreground">
          {group.cpeCount} dispositivos
        </p>
      </div>
      <ul className="max-h-[28rem] space-y-1 overflow-auto">
        {group.cpes.map((device) => (
          <li key={device.id}>
            <button
              type="button"
              className="w-full rounded-md px-2 py-1.5 text-left hover:bg-muted"
              onClick={() => onSelectObserved(device.id)}
            >
              <span className="block truncate font-medium">
                {device.hostname || device.managementIp || device.id}
              </span>
              {device.managementIp ? (
                <span className="block truncate text-xs text-muted-foreground">
                  {device.managementIp}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DetailSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2 border-t border-border/70 pt-3">
      <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

function StatusLine({
  label,
  dotClass,
  value,
}: {
  label: string
  dotClass: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-right">
        <span className={cn("inline-block size-1.5 shrink-0 rounded-full", dotClass)} />
        {value}
      </span>
    </div>
  )
}

function connectionStatusCopy(
  connection: ReturnType<typeof managementStateForDevice>["connection"]
): {
  label: string
  summary: string
  dotClass: string
} {
  if (connection === "verified") {
    return {
      label: "Verificada",
      summary: "Conexión verificada",
      dotClass: "bg-emerald-500",
    }
  }
  if (connection === "error") {
    return {
      label: "Error de conexión",
      summary: "Error de conexión",
      dotClass: "bg-red-500",
    }
  }
  if (connection === "in_progress") {
    return {
      label: "En curso",
      summary: "Probando conexión...",
      dotClass: "bg-amber-500",
    }
  }
  return {
    label: "Sin verificar",
    summary: "Sin verificar",
    dotClass: "bg-slate-400",
  }
}

const DETAIL_ACTION_CLASS =
  "w-full rounded-md border bg-background px-3 py-2 text-sm font-medium hover:border-foreground/40 disabled:opacity-50"
const DETAIL_SECONDARY_ACTION_CLASS =
  "w-full rounded-md border border-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-border hover:text-foreground disabled:opacity-50"

function SelectedObservedPanel({
  device,
  agentName,
  state,
  busy,
  actionError,
  onClose,
  onAdminister,
  onReplace,
  onTest,
  onDiscover,
}: {
  device: LocalTopologyObservedDevice
  agentName?: string | null
  state: ReturnType<typeof managementStateForDevice>
  busy: "test" | "discover" | null
  actionError: string | null
  onClose: () => void
  onAdminister: () => void
  onReplace: () => void
  onTest: () => void
  onDiscover: () => void
}) {
  const vendor = resolveNetworkManagementVendor({
    manufacturer: device.platform,
    platform: device.platform,
    board: device.board,
  })
  const discoveryInflight = state.discovery === "in_progress"
  const connectionInflight = state.connection === "in_progress"
  const title =
    device.hostname?.trim() || device.managementIp?.trim() || "Sin nombre"
  const ip = device.managementIp?.trim() || null
  const showIp = Boolean(ip) && ip !== title
  const vendorLabel = device.platform || networkManagementVendorLabel(vendor)
  const hardwareParts = [vendorLabel !== "—" ? vendorLabel : null, device.board]
    .filter((part): part is string => Boolean(part))
    .filter((part, index, parts) => parts.indexOf(part) === index)
  const connection = connectionStatusCopy(state.connection)
  const showDiscoveryFields = Boolean(
    device.observedInterfaceName || device.discoveredBy
  )
  const showDiscoverySection =
    showDiscoveryFields || state.canDiscover || discoveryInflight
  const diagnosticJobLabel = state.diagnosticJob
    ? NETWORK_JOB_STATUS_LABELS[
        state.diagnosticJob.status as keyof typeof NETWORK_JOB_STATUS_LABELS
      ]
    : null
  const discoveryJobLabel = state.discoveryJob
    ? NETWORK_JOB_STATUS_LABELS[
        state.discoveryJob.status as keyof typeof NETWORK_JOB_STATUS_LABELS
      ]
    : null

  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Equipo
        </p>
        <PanelCloseButton onClose={onClose} />
      </div>
      <div className="space-y-1 pb-1">
        <p className="text-lg font-semibold leading-tight">{title}</p>
        {showIp ? (
          <p className="text-sm text-muted-foreground">{ip}</p>
        ) : null}
        {hardwareParts.length > 0 ? (
          <p className="text-sm">{hardwareParts.join(" · ")}</p>
        ) : null}
        {device.macAddress ? (
          <p className="text-xs text-muted-foreground">
            MAC
            <span className="mt-0.5 block font-mono text-foreground">
              {device.macAddress}
            </span>
          </p>
        ) : null}
        {device.version ? (
          <p className="text-xs text-muted-foreground">
            Version: {device.version}
          </p>
        ) : null}
      </div>

      <DetailSection title="Estado">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span
            className={cn(
              "inline-block size-2 rounded-full",
              statusDotClass(device.operationalStatus)
            )}
          />
          {monitoringLabel(device.operationalStatus)}
        </p>
        <div className="space-y-1 text-sm">
          <StatusLine
            label="Administración"
            dotClass={device.managed ? "bg-emerald-500" : "bg-slate-400"}
            value={device.managed ? "Administrado" : "No administrado"}
          />
          {device.managed ? (
            <StatusLine
              label="Credencial"
              dotClass={
                state.credential === "unavailable"
                  ? "bg-red-500"
                  : "bg-emerald-500"
              }
              value={
                state.credential === "unavailable"
                  ? "No disponible"
                  : "Disponible"
              }
            />
          ) : null}
          <StatusLine
            label="Conexión"
            dotClass={connection.dotClass}
            value={connection.label}
          />
          <StatusLine
            label="Monitoreo"
            dotClass={statusDotClass(device.operationalStatus)}
            value={monitoringLabel(device.operationalStatus)}
          />
        </div>
        {device.lastPollAt ? (
          <p className="text-xs text-muted-foreground">
            Última observación: {formatNetworkTimestamp(device.lastPollAt)}
          </p>
        ) : null}
        {device.managed && state.decryptError ? (
          <p className="text-xs text-destructive">
            No se pudo descifrar la credencial del destino.
          </p>
        ) : null}
      </DetailSection>

      <DetailSection title="Administración">
        {agentName ? (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Agent</span>
            <span className="text-right">{agentName}</span>
          </div>
        ) : null}
        {device.managed ? (
          <StatusLine
            label="Credencial"
            dotClass={
              state.credential === "unavailable" ? "bg-red-500" : "bg-emerald-500"
            }
            value={
              state.credential === "unavailable" ? "No disponible" : "Disponible"
            }
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Este equipo todavía no está administrado.
          </p>
        )}
        {state.canAdminister ? (
          <button type="button" className={DETAIL_ACTION_CLASS} onClick={onAdminister}>
            Administrar dispositivo
          </button>
        ) : null}
        {state.canReplace ? (
          <button type="button" className={DETAIL_ACTION_CLASS} onClick={onReplace}>
            Reemplazar credenciales
          </button>
        ) : null}
      </DetailSection>

      <DetailSection title="Conexión">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span
            className={cn("inline-block size-1.5 rounded-full", connection.dotClass)}
          />
          {connection.summary}
        </p>
        {connectionInflight ? (
          <p className="text-xs text-muted-foreground">
            Administrando
            {diagnosticJobLabel ? ` · ${diagnosticJobLabel}` : ""}
          </p>
        ) : null}
        {state.connection === "error" && state.diagnosticJob?.errorMessage ? (
          <p className="text-xs text-destructive">
            {state.diagnosticJob.errorMessage}
          </p>
        ) : null}
        {actionError ? (
          <p className="text-sm text-destructive">{actionError}</p>
        ) : null}
        {state.canTest ? (
          <button
            type="button"
            className={DETAIL_ACTION_CLASS}
            disabled={busy != null || connectionInflight}
            onClick={onTest}
          >
            {busy === "test" ? "Probando…" : "Probar conexión"}
          </button>
        ) : null}
      </DetailSection>

      {showDiscoverySection ? (
        <DetailSection title="Discovery">
          {showDiscoveryFields ? (
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Interfaz observada: {device.observedInterfaceName || "—"}</p>
              <p>Discovered-by: {device.discoveredBy || "—"}</p>
              {device.origin ? <p>Origen: {device.origin}</p> : null}
              <p>Último seen: {formatNetworkTimestamp(device.lastSeenAt)}</p>
            </div>
          ) : null}
          {discoveryInflight ? (
            <p className="text-xs text-muted-foreground">
              Descubriendo...
              {discoveryJobLabel ? ` · ${discoveryJobLabel}` : ""}
            </p>
          ) : null}
          {state.discovery === "failed" && state.discoveryJob?.errorMessage ? (
            <p className="text-xs text-destructive">
              {state.discoveryJob.errorMessage}
            </p>
          ) : null}
          {state.canDiscover ? (
            <button
              type="button"
              className={DETAIL_SECONDARY_ACTION_CLASS}
              disabled={busy != null || discoveryInflight}
              onClick={onDiscover}
            >
              {busy === "discover" ? "Descubriendo…" : "Descubrir ahora"}
            </button>
          ) : null}
        </DetailSection>
      ) : null}
    </div>
  )
}

function PanelCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      className="text-xs text-muted-foreground underline"
      onClick={onClose}
    >
      Cerrar
    </button>
  )
}

function OperationalStatusBlock({
  node,
}: {
  node: Pick<NetworkTopologyNode, "kind" | "operationalStatus" | "lastPollAt">
}) {
  if (node.kind !== "managed") {
    return (
      <div className="space-y-1">
        <p className="text-muted-foreground">Sin monitoreo</p>
        <p className="text-muted-foreground">Última observación: —</p>
      </div>
    )
  }
  return (
    <div className="space-y-1">
      {node.operationalStatus ? (
        <StatusBadge
          className={cn(
            STATUS_TONE_STYLES[NETWORK_DEVICE_STATUS_TONES[node.operationalStatus]]
          )}
        >
          {NETWORK_DEVICE_STATUS_LABELS[node.operationalStatus]}
        </StatusBadge>
      ) : (
        <p className="text-muted-foreground">Sin monitoreo</p>
      )}
      <p className="text-muted-foreground">
        Última observación: {formatNetworkTimestamp(node.lastPollAt)}
      </p>
    </div>
  )
}

function SelectedNodePanel({
  node,
  edges,
  nodesById,
  onClose,
  onSelectEdge,
}: {
  node: NetworkTopologyNode
  edges: NetworkTopologyEdge[]
  nodesById: Map<string, NetworkTopologyNode & { x: number; y: number }>
  onClose: () => void
  onSelectEdge: (edgeId: string) => void
}) {
  const deviceHref = topologyManagedDeviceHref(node)
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Nodo
        </p>
        <PanelCloseButton onClose={onClose} />
      </div>
      <div>
        <p className="text-base font-medium">
          {formatTopologyNodeIdentity(node.hostname, node.managementIp)}
        </p>
        <p className="text-muted-foreground">{node.managementIp || "Sin IP"}</p>
      </div>
      <p>
        {NETWORK_DEVICE_TYPE_LABELS[node.deviceType]} ·{" "}
        {node.kind === "managed" ? "Administrado" : "Vecino descubierto"}
      </p>
      <OperationalStatusBlock node={node} />
      {deviceHref ? (
        <Link className="inline-block underline" href={deviceHref}>
          Ver dispositivo
        </Link>
      ) : null}
      <div>
        <p className="mb-1 font-medium">Enlaces</p>
        {edges.length === 0 ? (
          <p className="text-muted-foreground">Sin enlaces persistidos.</p>
        ) : (
          <ul className="space-y-1">
            {edges.map((edge) => {
              const otherId =
                edge.sourceDeviceId === node.id
                  ? edge.targetDeviceId
                  : edge.sourceDeviceId
              const other = nodesById.get(otherId)
              return (
                <li key={edge.id}>
                  <button
                    type="button"
                    className="text-left underline-offset-2 hover:underline"
                    onClick={() => onSelectEdge(edge.id)}
                  >
                    {formatTopologyPeerLink({
                      selectedDeviceId: node.id,
                      edge,
                      peerHostname: other?.hostname,
                      peerManagementIp: other?.managementIp,
                    })}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {node.interfaces.length > 0 ? (
        <div>
          <p className="mb-1 font-medium">Interfaces</p>
          <ul className="space-y-1">
            {node.interfaces.map((iface) => (
              <li key={iface.id}>
                {iface.name}
                {iface.status ? ` · ${iface.status}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function SelectedEdgePanel({
  edge,
  nodesById,
  onClose,
}: {
  edge: NetworkTopologyEdge
  nodesById: Map<string, NetworkTopologyNode>
  onClose: () => void
}) {
  const detail = buildTopologyEdgeDetail(edge, nodesById)
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Enlace
        </p>
        <PanelCloseButton onClose={onClose} />
      </div>
      <div>
        <p className="text-base font-medium">{detail.interfacesLabel}</p>
        <p className="text-muted-foreground">{detail.protocolsLabel}</p>
      </div>
      <EdgeEndpointBlock title="Dispositivo A" endpoint={detail.endpointA} />
      <EdgeEndpointBlock title="Dispositivo B" endpoint={detail.endpointB} />
    </div>
  )
}

function EdgeEndpointBlock({
  title,
  endpoint,
}: {
  title: string
  endpoint: ReturnType<typeof buildTopologyEdgeDetail>["endpointA"]
}) {
  return (
    <div className="space-y-1 rounded-md border px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p className="font-medium">{endpoint.identity}</p>
      {endpoint.managementIp && endpoint.hostname ? (
        <p className="text-muted-foreground">{endpoint.managementIp}</p>
      ) : null}
      <p>
        Interfaz: {endpoint.interfaceName ?? "—"}
      </p>
      <OperationalStatusBlock
        node={{
          kind: endpoint.kind === "managed" ? "managed" : "neighbor",
          operationalStatus: endpoint.operationalStatus,
          lastPollAt: endpoint.lastPollAt,
        }}
      />
      {endpoint.deviceHref ? (
        <Link className="inline-block underline" href={endpoint.deviceHref}>
          Ver dispositivo
        </Link>
      ) : null}
    </div>
  )
}
