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
  topologyManagedDeviceHref,
} from "@/lib/network/topology/graph"
import type {
  NetworkTopologyEdge,
  NetworkTopologyNode,
} from "@/lib/network/topology/types"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

const CANVAS_WIDTH = 920
const CANVAS_HEIGHT = 520

type TopologySelection =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string }

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

export function NetworkTopologyScreen() {
  const { data, error, isPending } = useNetworkTopologyQuery()
  const [selection, setSelection] = useState<TopologySelection | null>(null)
  const graph = data ?? { nodes: [], edges: [] }
  const positioned = useMemo(() => layoutNodes(graph.nodes), [graph.nodes])
  const byId = useMemo(
    () => new Map(positioned.map((node) => [node.id, node])),
    [positioned]
  )
  const selectedNode =
    selection?.kind === "node" ? (byId.get(selection.id) ?? null) : null
  const selectedEdge =
    selection?.kind === "edge"
      ? (graph.edges.find((edge) => edge.id === selection.id) ?? null)
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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Topología</h1>
        <p className="text-sm text-muted-foreground">
          Grafo de dispositivos administrados y vecinos descubiertos por Discovery.
        </p>
        <NetworkSubnav current="topology" />
      </div>

      {loadError && !data ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-auto rounded-lg border bg-card">
          {isPending && graph.nodes.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Cargando topología…</p>
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
                onClick={() => setSelection(null)}
              />
              {graph.edges.map((edge) => {
                const source = byId.get(edge.sourceDeviceId)
                const target = byId.get(edge.targetDeviceId)
                if (!source || !target) return null
                const mx = (source.x + target.x) / 2
                const my = (source.y + target.y) / 2
                const active = selection?.kind === "edge" && selection.id === edge.id
                return (
                  <g
                    key={edge.id}
                    className="cursor-pointer"
                    onClick={(event) => {
                      event.stopPropagation()
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
                    setSelection({ kind: "node", id: node.id })
                  }}
                  className="cursor-pointer"
                >
                  <circle
                    r={
                      selection?.kind === "node" && selection.id === node.id ? 22 : 18
                    }
                    fill={nodeFill(node)}
                    stroke={nodeStroke(node)}
                    strokeWidth={
                      selection?.kind === "node" && selection.id === node.id ? 3 : 2
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
          {selectedNode ? (
            <SelectedNodePanel
              node={selectedNode}
              edges={relatedEdges}
              nodesById={byId}
              onClose={() => setSelection(null)}
              onSelectEdge={(edgeId) => setSelection({ kind: "edge", id: edgeId })}
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
