"use client"

import { NetworkSubnav } from "@/components/network/network-subnav"
import { NocTopologyTree } from "@/components/network/noc-topology-tree"
import { formatNetworkTimestamp } from "@/lib/network/labels"
import { NETWORK_UI_REFETCH_INTERVAL_MS } from "@/lib/network/react-query/defaults"
import { useNetworkNocQuery } from "@/lib/network/react-query/use-network-noc-query"
import type { NocAlarmView } from "@/lib/network/noc/types"
import { cn } from "@/lib/utils"

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number | string
  tone?: "online" | "attention" | "offline" | "alarm"
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "online" && "text-emerald-600",
          tone === "attention" && "text-amber-600",
          tone === "offline" && "text-red-600",
          tone === "alarm" && "text-red-600"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function AlarmList({ alarms }: { alarms: readonly NocAlarmView[] }) {
  if (alarms.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No hay alarmas activas.</p>
    )
  }
  return (
    <ul className="max-h-40 space-y-2 overflow-y-auto text-sm">
      {alarms.map((alarm) => (
        <li key={alarm.id} className="rounded-md border px-3 py-2">
          <p className="font-medium">{alarm.title}</p>
          <p className="text-xs text-muted-foreground">{alarm.message}</p>
        </li>
      ))}
    </ul>
  )
}

export function NetworkNocMonitorScreen() {
  const { data, error, isFetching, dataUpdatedAt } = useNetworkNocQuery()
  const loadError =
    error instanceof Error
      ? error.message
      : error
        ? "No se pudo cargar el monitor NOC."
        : null
  const summary = data?.summary
  const lastUpdated = data?.lastUpdatedAt ?? (dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null)

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-4">
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
                isFetching ? "bg-amber-500" : "bg-emerald-500"
              )}
            />
            {isFetching ? "Actualizando…" : "En vivo"}
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
          label="Alarmas activas"
          value={summary?.activeAlarmCount ?? "—"}
          tone="alarm"
        />
      </div>

      {data && data.alarms.length > 0 ? (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Alarmas activas
          </h2>
          <AlarmList alarms={data.alarms} />
        </section>
      ) : null}

      <section className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
        <NocTopologyTree forest={data?.topology ?? { roots: [] }} />
      </section>
    </div>
  )
}
