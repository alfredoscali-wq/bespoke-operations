"use client"

import { useMemo, useState } from "react"
import Link from "next/link"

import { NetworkSubnav } from "@/components/network/network-subnav"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  NETWORK_DEVICE_STATUS_LABELS,
  NETWORK_DEVICE_STATUS_TONES,
  NETWORK_DEVICE_TYPE_LABELS,
  formatNetworkTimestamp,
} from "@/lib/network/labels"
import { useNetworkTopologyQuery } from "@/lib/network/react-query/use-network-topology-query"
import {
  buildTopologyEdgeDetail,
  formatTopologyNodeIdentity,
  formatTopologyPeerLink,
  resolveTopologySelection,
  topologyManagedDeviceHref,
  type TopologySelection,
} from "@/lib/network/topology/graph"
import type {
  LocalCoreTopologyView,
  LocalTopologyObservedDevice,
  NetworkTopologyEdge,
  NetworkTopologyNode,
} from "@/lib/network/topology/types"
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

export function NetworkTopologyScreen() {
  const [selectedCoreId, setSelectedCoreId] = useState<string | null>(null)
  const { data, error, isPending } = useNetworkTopologyQuery(selectedCoreId)
  const [selection, setSelection] = useState<TopologySelection | null>(null)
  const [observedId, setObservedId] = useState<string | null>(null)
  const graph = data?.graph ?? { nodes: [], edges: [] }
  const cores = data?.cores ?? []
  const local = data?.local ?? null
  const activeCoreId = selectedCoreId ?? cores[0]?.id ?? null
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
  const observedById = useMemo(() => {
    const map = new Map<string, LocalTopologyObservedDevice>()
    for (const group of local?.interfaceGroups ?? []) {
      for (const device of group.devices) map.set(device.id, device)
    }
    return map
  }, [local])
  const selectedObserved = observedId ? (observedById.get(observedId) ?? null) : null
  const selectedNode =
    !selectedObserved && activeSelection?.kind === "node"
      ? (byId.get(activeSelection.id) ??
          graph.nodes.find((node) => node.id === activeSelection.id) ??
          null)
      : null
  const selectedEdge =
    !selectedObserved && activeSelection?.kind === "edge"
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

  function selectCoreNode(coreId: string) {
    setObservedId(null)
    setSelection({ kind: "node", id: coreId })
  }

  function selectObserved(deviceId: string) {
    setSelection(null)
    setObservedId(deviceId)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Topología</h1>
        <p className="text-sm text-muted-foreground">
          Vista local del Core seleccionado: observaciones LAN/VLAN del último
          discovery, agrupadas por interfaz.
        </p>
        <NetworkSubnav current="topology" />
      </div>

      {cores.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Core</span>
            <select
              className="block h-9 min-w-64 rounded-md border bg-background px-3"
              value={activeCoreId ?? ""}
              onChange={(event) => {
                setSelectedCoreId(event.target.value)
                setObservedId(null)
                setSelection({ kind: "node", id: event.target.value })
              }}
            >
              {cores.map((core) => (
                <option key={core.id} value={core.id}>
                  {core.hostname || core.managementIp || core.id}
                </option>
              ))}
            </select>
          </label>
          {local?.core ? (
            <div className="flex items-center gap-2 pb-1 text-sm">
              <span
                className={cn(
                  "inline-block size-2.5 rounded-full",
                  statusDotClass(local.core.operationalStatus)
                )}
              />
              <span>
                Estado:{" "}
                {local.core.operationalStatus
                  ? NETWORK_DEVICE_STATUS_LABELS[local.core.operationalStatus]
                  : "Sin monitoring"}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {loadError && !data ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-auto rounded-lg border bg-card">
          {isPending && graph.nodes.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Cargando topología…</p>
          ) : local ? (
            <LocalCoreTree
              local={local}
              selectedCoreId={
                selectedObserved ? null : (activeSelection?.kind === "node" ? activeSelection.id : null)
              }
              selectedObservedId={observedId}
              onSelectCore={() => selectCoreNode(local.core.id)}
              onSelectObserved={selectObserved}
            />
          ) : graph.nodes.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Todavía no hay dispositivos descubiertos. Ejecutá un discovery desde un
              Agent.
            </p>
          ) : (
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
                  setObservedId(null)
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
                      setObservedId(null)
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
          )}
        </div>

        <aside className="rounded-lg border bg-card p-4 text-sm">
          {selectedObserved ? (
            <SelectedObservedPanel
              device={selectedObserved}
              onClose={() => setObservedId(null)}
            />
          ) : selectedNode ? (
            <SelectedNodePanel
              node={selectedNode}
              edges={relatedEdges}
              nodesById={byId}
              onClose={() => setSelection(null)}
              onSelectEdge={(edgeId) => {
                setObservedId(null)
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
              Seleccioná un dispositivo o un enlace.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}

function LocalCoreTree({
  local,
  selectedCoreId,
  selectedObservedId,
  onSelectCore,
  onSelectObserved,
}: {
  local: LocalCoreTopologyView
  selectedCoreId: string | null
  selectedObservedId: string | null
  onSelectCore: () => void
  onSelectObserved: (deviceId: string) => void
}) {
  const coreSelected = selectedCoreId === local.core.id
  return (
    <div className="space-y-4 p-6 font-mono text-sm">
      <button
        type="button"
        className={cn(
          "w-full rounded-md border px-3 py-2 text-left",
          coreSelected ? "border-foreground" : "border-transparent hover:border-border"
        )}
        onClick={onSelectCore}
      >
        <p className="text-xs font-sans font-medium uppercase tracking-wide text-muted-foreground">
          {local.core.hostname || "Core"}
        </p>
        <p className="flex items-center gap-2 font-sans text-base font-semibold">
          <span
            className={cn(
              "inline-block size-2.5 rounded-full",
              statusDotClass(local.core.operationalStatus)
            )}
          />
          {local.core.hostname || local.core.managementIp || "Core"}
        </p>
        {local.core.managementIp ? (
          <p className="font-sans text-muted-foreground">{local.core.managementIp}</p>
        ) : null}
      </button>

      <div>
        <p className="mb-2 font-sans text-xs font-medium uppercase tracking-wide text-muted-foreground">
          LAN / VLAN
        </p>
        {local.interfaceGroups.length === 0 ? (
          <p className="font-sans text-muted-foreground">
            No hay observaciones LAN/VLAN en el último discovery de este Core.
          </p>
        ) : (
          <ul className="space-y-3">
            {local.interfaceGroups.map((group) => (
              <li key={group.interfaceName ?? "sin-interfaz"}>
                <p className="font-semibold">
                  {group.interfaceName || "Sin interfaz observada"}
                </p>
                <ul className="ml-4 border-l pl-4">
                  {group.devices.map((device) => {
                    const selected = selectedObservedId === device.id
                    return (
                      <li key={device.id}>
                        <button
                          type="button"
                          className={cn(
                            "w-full rounded px-1 py-1 text-left",
                            selected ? "bg-muted" : "hover:bg-muted/60"
                          )}
                          onClick={() => onSelectObserved(device.id)}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-block size-2 rounded-full",
                                statusDotClass(device.operationalStatus)
                              )}
                            />
                            <span>
                              {device.hostname || device.managementIp || device.id}
                            </span>
                          </span>
                          {device.managementIp ? (
                            <span className="block pl-4 text-xs text-muted-foreground">
                              {device.managementIp}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                  {group.cpeCount > 0 ? (
                    <li className="py-1 text-muted-foreground">
                      CPE observados: {group.cpeCount}
                    </li>
                  ) : null}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      {local.cpeObservedCount > 0 ? (
        <p className="font-sans text-sm text-muted-foreground">
          CPE observados: {local.cpeObservedCount}
        </p>
      ) : null}
      {local.wanObservedCount > 0 ? (
        <p className="font-sans text-sm text-muted-foreground">
          WAN observado: {local.wanObservedCount}
        </p>
      ) : null}
    </div>
  )
}

function SelectedObservedPanel({
  device,
  onClose,
}: {
  device: LocalTopologyObservedDevice
  onClose: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Observado
        </p>
        <PanelCloseButton onClose={onClose} />
      </div>
      <div>
        <p className="text-base font-medium">
          {formatTopologyNodeIdentity(device.hostname, device.managementIp)}
        </p>
        <p className="text-muted-foreground">{device.managementIp || "Sin IP"}</p>
      </div>
      <p>MAC: {device.macAddress || "—"}</p>
      <p>Interfaz observada: {device.observedInterfaceName || "—"}</p>
      <p>Platform: {device.platform || "—"}</p>
      <p>Board: {device.board || "—"}</p>
      <p>Version: {device.version || "—"}</p>
      <p>Discovered-by: {device.discoveredBy || "—"}</p>
      <p>Origen: {device.origin || "—"}</p>
      <p>
        Último seen: {formatNetworkTimestamp(device.lastSeenAt)}
      </p>
      {device.operationalStatus ? (
        <OperationalStatusBlock
          node={{
            kind: "managed",
            operationalStatus: device.operationalStatus,
            lastPollAt: device.lastPollAt,
          }}
        />
      ) : (
        <p className="text-muted-foreground">No monitoreado</p>
      )}
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
        <p className="text-muted-foreground">No monitoreado</p>
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
        <p className="text-muted-foreground">Sin estado operativo de monitoring.</p>
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
