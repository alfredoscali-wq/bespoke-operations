"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"

import { NetworkSubnav } from "@/components/network/network-subnav"
import { NocTopologyTree } from "@/components/network/noc-topology-tree"
import { formatNetworkTimestamp } from "@/lib/network/labels"
import {
  buildNocAlarmOverlayByDeviceId,
  collectNocForestDeviceIds,
  countNocAlarmKpis,
  nocActiveAlarmsForDevice,
} from "@/lib/network/noc/alarm-visual"
import type { NocTopologyForest, NocTopologyNode } from "@/lib/network/noc/types"
import { NETWORK_UI_REFETCH_INTERVAL_MS } from "@/lib/network/react-query/defaults"
import { useNetworkAlarmsQuery } from "@/lib/network/react-query/use-network-alarms-query"
import { useNetworkNocQuery } from "@/lib/network/react-query/use-network-noc-query"
import { cn } from "@/lib/utils"

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number | string
  tone?: "online" | "attention" | "offline" | "critical" | "warning"
}) {
  const active =
    (tone === "critical" || tone === "warning") && Number(value) > 0
  return (
    <div
      className={cn(
        "rounded-lg border bg-card px-3 py-2",
        active && tone === "critical" && "border-red-600/70 bg-red-600/10",
        active && tone === "warning" && "border-amber-500/70 bg-amber-400/10"
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          tone === "online" && "text-emerald-600",
          tone === "attention" && "text-amber-600",
          tone === "offline" && "text-red-600",
          tone === "critical" && Number(value) > 0 && "text-red-700",
          tone === "warning" && Number(value) > 0 && "text-amber-700"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function walkNodes(nodes: readonly NocTopologyNode[], visit: (node: NocTopologyNode) => void) {
  for (const node of nodes) {
    visit(node)
    walkNodes(node.children, visit)
  }
}

function findNocNode(
  forest: NocTopologyForest,
  deviceId: string
): NocTopologyNode | null {
  let found: NocTopologyNode | null = null
  walkNodes(forest.roots, (node) => {
    if (node.deviceId === deviceId) found = node
  })
  return found
}

function healthLabel(health: NocTopologyNode["health"]): string {
  if (health === "online") return "Online"
  if (health === "attention") return "Atención"
  if (health === "offline") return "Offline"
  return "Sin estado"
}

export function NetworkNocMonitorScreen() {
  const nocQuery = useNetworkNocQuery()
  const alarmsQuery = useNetworkAlarmsQuery()
  const knownIds = useRef<Set<string> | null>(null)
  const [newCriticalIds, setNewCriticalIds] = useState<Set<string>>(() => new Set())
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)

  const { data, error, isFetching, dataUpdatedAt } = nocQuery
  const loadError =
    error instanceof Error
      ? error.message
      : error
        ? "No se pudo cargar el monitor NOC."
        : null
  const lastUpdatedMs = Math.max(dataUpdatedAt || 0, alarmsQuery.dataUpdatedAt || 0)
  const lastUpdated =
    data?.lastUpdatedAt ?? (lastUpdatedMs ? new Date(lastUpdatedMs).toISOString() : null)
  const liveFetching = isFetching || alarmsQuery.isFetching

  const topology: NocTopologyForest = data?.topology ?? { roots: [] }
  const summary = data?.summary
  const forestDeviceIds = useMemo(
    () => collectNocForestDeviceIds(topology),
    [topology]
  )
  const alarmKpis = useMemo(
    () => countNocAlarmKpis(alarmsQuery.data ?? []),
    [alarmsQuery.data]
  )

  useEffect(() => {
    const alarms = alarmsQuery.data ?? []
    if (!alarmsQuery.data) return
    if (knownIds.current == null) {
      knownIds.current = new Set(alarms.map((alarm) => alarm.id))
      return
    }
    const incoming = new Set<string>()
    for (const alarm of alarms) {
      if (
        !knownIds.current.has(alarm.id) &&
        alarm.severity === "critical" &&
        alarm.status === "open"
      ) {
        incoming.add(alarm.id)
      }
      knownIds.current.add(alarm.id)
    }
    if (incoming.size === 0) return
    setNewCriticalIds((current) => {
      const next = new Set(current)
      for (const id of incoming) next.add(id)
      return next
    })
  }, [alarmsQuery.data])

  const alarmByDeviceId = useMemo(
    () =>
      buildNocAlarmOverlayByDeviceId(
        topology,
        alarmsQuery.data ?? [],
        newCriticalIds
      ),
    [topology, alarmsQuery.data, newCriticalIds]
  )

  const selectedNode = selectedDeviceId
    ? findNocNode(topology, selectedDeviceId)
    : null
  const selectedAlarms = selectedDeviceId
    ? nocActiveAlarmsForDevice(alarmsQuery.data ?? [], selectedDeviceId)
    : []

  useEffect(() => {
    if (!selectedDeviceId) return
    if (!forestDeviceIds.has(selectedDeviceId)) {
      setSelectedDeviceId(null)
    }
  }, [forestDeviceIds, selectedDeviceId])

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-3 overflow-x-hidden">
      <style>{`
        @keyframes noc-alarm-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgb(220 38 38 / 0.55); }
          50% { box-shadow: 0 0 0 10px rgb(220 38 38 / 0); }
        }
        @keyframes noc-nueva-fade {
          0%, 65% { opacity: 1; }
          100% { opacity: 0; }
        }
        .noc-alarm-pulse {
          animation: noc-alarm-pulse 0.85s ease-out 2;
        }
        .noc-nueva-badge {
          animation: noc-nueva-fade 4s ease-out forwards;
        }
      `}</style>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            NOC / Monitor
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {data?.companyName ?? "Empresa"}
          </h1>
          <NetworkSubnav current="noc" />
        </div>
        <div className="text-right text-sm">
          <p className="flex items-center justify-end gap-2">
            <span
              className={cn(
                "inline-block size-2 rounded-full",
                liveFetching ? "bg-amber-500" : "bg-emerald-500"
              )}
            />
            {liveFetching ? "Actualizando…" : "En vivo"}
          </p>
          <p className="text-xs text-muted-foreground">
            Última actualización: {formatNetworkTimestamp(lastUpdated)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Refresh cada {NETWORK_UI_REFETCH_INTERVAL_MS / 1000}s
          </p>
        </div>
      </header>

      {loadError && !data ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <SummaryStat label="Equipos" value={summary?.deviceCount ?? "—"} />
        <SummaryStat
          label="Online"
          value={summary?.onlineCount ?? "—"}
          tone="online"
        />
        <SummaryStat
          label="Atención"
          value={summary?.attentionCount ?? "—"}
          tone="attention"
        />
        <SummaryStat
          label="Offline"
          value={summary?.offlineCount ?? "—"}
          tone="offline"
        />
        <SummaryStat
          label="🔴 Crítica"
          value={alarmsQuery.isPending && !alarmsQuery.data ? "—" : alarmKpis.critical}
          tone="critical"
        />
        <SummaryStat
          label="🟡 Advertencias"
          value={alarmsQuery.isPending && !alarmsQuery.data ? "—" : alarmKpis.warning}
          tone="warning"
        />
      </div>

      {selectedNode ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card px-3 py-2">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold">{selectedNode.label}</p>
            {selectedNode.ipAddress ? (
              <p className="text-xs text-muted-foreground">{selectedNode.ipAddress}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {healthLabel(selectedNode.health)}
            </p>
            {selectedAlarms[0] ? (
              <p
                className={cn(
                  "text-xs font-medium",
                  selectedAlarms[0].severity === "critical"
                    ? "text-red-700"
                    : "text-amber-700"
                )}
              >
                {selectedAlarms[0].severity === "critical"
                  ? "ALARMA CRÍTICA"
                  : "ADVERTENCIA"}
                {" · "}
                {selectedAlarms[0].title}
                {selectedAlarms[0].message
                  ? ` — ${selectedAlarms[0].message}`
                  : ""}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Sin alarma activa</p>
            )}
          </div>
          {selectedAlarms.length > 0 ? (
            <Link
              href="/network/alarms"
              className="text-xs font-medium underline-offset-4 hover:underline"
            >
              Ver en Alarmas
            </Link>
          ) : null}
        </div>
      ) : null}

      <section className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
        <NocTopologyTree
          forest={topology}
          alarmByDeviceId={alarmByDeviceId}
          selectedDeviceId={selectedDeviceId}
          onSelectDevice={setSelectedDeviceId}
        />
      </section>
    </div>
  )
}
