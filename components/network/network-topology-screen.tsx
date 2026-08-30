"use client"

import { useMemo, useState } from "react"
import Link from "next/link"

import { NetworkSubnav } from "@/components/network/network-subnav"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  NETWORK_DEVICE_STATUS_LABELS,
  NETWORK_DEVICE_STATUS_TONES,
  NETWORK_DEVICE_TYPE_LABELS,
} from "@/lib/network/labels"
import { useNetworkTopologyQuery } from "@/lib/network/react-query/use-network-topology-query"
import type {
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

export function NetworkTopologyScreen() {
  const { data, error, isPending } = useNetworkTopologyQuery()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const graph = data ?? { nodes: [], edges: [] }
  const positioned = useMemo(() => layoutNodes(graph.nodes), [graph.nodes])
  const byId = useMemo(
    () => new Map(positioned.map((node) => [node.id, node])),
    [positioned]
  )
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null
  const relatedEdges = useMemo(
    () =>
      graph.edges.filter(
        (edge) =>
          edge.sourceDeviceId === selectedId || edge.targetDeviceId === selectedId
      ),
    [graph.edges, selectedId]
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
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
              {graph.edges.map((edge) => {
                const source = byId.get(edge.sourceDeviceId)
                const target = byId.get(edge.targetDeviceId)
                if (!source || !target) return null
                const mx = (source.x + target.x) / 2
                const my = (source.y + target.y) / 2
                return (
                  <g key={edge.id}>
                    <line
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke="#94a3b8"
                      strokeWidth={1.5}
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
                  onClick={() => setSelectedId(node.id)}
                  className="cursor-pointer"
                >
                  <circle
                    r={selectedId === node.id ? 22 : 18}
                    fill={nodeFill(node)}
                    stroke={nodeStroke(node)}
                    strokeWidth={selectedId === node.id ? 3 : 2}
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
          {selected ? (
            <SelectedNodePanel
              node={selected}
              edges={relatedEdges}
              nodesById={byId}
            />
          ) : (
            <p className="text-muted-foreground">
              Seleccioná un dispositivo para ver hostname, origen y enlaces.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}

function SelectedNodePanel({
  node,
  edges,
  nodesById,
}: {
  node: NetworkTopologyNode
  edges: NetworkTopologyEdge[]
  nodesById: Map<string, NetworkTopologyNode & { x: number; y: number }>
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-medium">
          {node.hostname || node.managementIp || "Sin nombre"}
        </p>
        <p className="text-muted-foreground">{node.managementIp || "Sin IP"}</p>
      </div>
      <p>
        {NETWORK_DEVICE_TYPE_LABELS[node.deviceType]} ·{" "}
        {node.kind === "managed" ? "Administrado" : "Vecino descubierto"}
      </p>
      {node.kind === "managed" && node.operationalStatus ? (
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
      {node.kind === "managed" ? (
        <Link className="inline-block underline" href={`/network/devices/${node.id}`}>
          Ver detalle
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
                  {edge.label}
                  {other
                    ? ` · ${other.hostname || other.managementIp || "vecino"}`
                    : ""}
                  {edge.protocol ? ` · ${edge.protocol}` : ""}
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
