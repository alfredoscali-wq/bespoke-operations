"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { NetworkSubnav } from "@/components/network/network-subnav"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  isActiveNetworkAlarmStatus,
  type NetworkAlarmDto,
} from "@/lib/network/alarms/contract"
import { networkAlarmMttrMs } from "@/lib/network/alarms/metrics"
import {
  formatNetworkHistoryDuration,
  formatNetworkTimestamp,
} from "@/lib/network/labels"
import {
  useNetworkAlarmMutations,
  useNetworkAlarmQuery,
  useNetworkAlarmsQuery,
} from "@/lib/network/react-query/use-network-alarms-query"
import { useNetworkDevicesQuery } from "@/lib/network/react-query/use-network-devices-query"
import type { NetworkDevice } from "@/lib/network/types"
import { cn } from "@/lib/utils"

function severityRank(severity: string): number {
  if (severity === "critical") return 0
  if (severity === "warning") return 1
  return 2
}

function sortActive(alarms: readonly NetworkAlarmDto[]): NetworkAlarmDto[] {
  return [...alarms].sort((left, right) => {
    const bySeverity = severityRank(left.severity) - severityRank(right.severity)
    if (bySeverity !== 0) return bySeverity
    return Date.parse(right.createdAt) - Date.parse(left.createdAt)
  })
}

function formatElapsed(value: string, nowMs: number): string {
  const created = Date.parse(value)
  if (!Number.isFinite(created)) return "—"
  const seconds = Math.max(0, Math.floor((nowMs - created) / 1000))
  return formatNetworkHistoryDuration(seconds)
}

function statusLabel(status: string): string {
  if (status === "open") return "Activa"
  if (status === "acknowledged") return "Reconocida"
  if (status === "resolved") return "Resuelta"
  return status
}

function deviceLabel(device: NetworkDevice | undefined, deviceId: string): string {
  if (!device) return deviceId
  return device.hostname?.trim() || device.managementIp?.trim() || deviceId
}

function Counter({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: "critical" | "warning" | "neutral"
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "critical" && "text-red-600",
          tone === "warning" && "text-amber-600"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function AlarmCard({
  alarm,
  device,
  isNew,
  nowMs,
  busy,
  onView,
  onAcknowledge,
  onResolve,
}: {
  alarm: NetworkAlarmDto
  device: NetworkDevice | undefined
  isNew: boolean
  nowMs: number
  busy: boolean
  onView: () => void
  onAcknowledge: () => void
  onResolve: () => void
}) {
  const critical = alarm.severity === "critical"
  const name = deviceLabel(device, alarm.deviceId)
  const ip = device?.managementIp
  const showIp = Boolean(ip) && ip !== name

  return (
    <article
      className={cn(
        "rounded-lg border px-4 py-3 shadow-sm",
        critical
          ? "border-red-500/70 bg-red-500/10"
          : "border-amber-500/70 bg-amber-500/10",
        isNew && "network-alarm-enter ring-2 ring-red-500/50"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-wide">
            <span className={critical ? "text-red-700" : "text-amber-700"}>
              {critical ? "Crítica" : "Advertencia"}
            </span>
            <span className="text-muted-foreground">{statusLabel(alarm.status)}</span>
            {isNew ? (
              <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                NUEVA
              </span>
            ) : null}
          </p>
          <h3 className="text-base font-semibold">{alarm.title}</h3>
          <p className="text-sm font-medium">{name}</p>
          {showIp ? <p className="text-xs text-muted-foreground">{ip}</p> : null}
          <p className="text-sm text-muted-foreground">{alarm.message}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>{formatNetworkTimestamp(alarm.createdAt)}</p>
          <p className="mt-1 tabular-nums">{formatElapsed(alarm.createdAt, nowMs)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onView} disabled={busy}>
          Ver
        </Button>
        {alarm.status === "open" ? (
          <Button size="sm" variant="secondary" onClick={onAcknowledge} disabled={busy}>
            Reconocer
          </Button>
        ) : null}
        {isActiveNetworkAlarmStatus(alarm.status) ? (
          <Button size="sm" variant="destructive" onClick={onResolve} disabled={busy}>
            Resolver
          </Button>
        ) : null}
      </div>
    </article>
  )
}

export function NetworkAlarmsScreen() {
  const alarmsQuery = useNetworkAlarmsQuery()
  const devicesQuery = useNetworkDevicesQuery()
  const mutations = useNetworkAlarmMutations()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const knownIds = useRef<Set<string> | null>(null)
  const [newCriticalIds, setNewCriticalIds] = useState<Set<string>>(() => new Set())
  const detailQuery = useNetworkAlarmQuery(selectedId)

  const alarms = alarmsQuery.data ?? []
  const nowMs = alarmsQuery.dataUpdatedAt || Date.now()
  const devicesById = useMemo(() => {
    const map = new Map<string, NetworkDevice>()
    for (const device of devicesQuery.data ?? []) {
      map.set(device.id, device)
    }
    return map
  }, [devicesQuery.data])

  useEffect(() => {
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
  }, [alarms, alarmsQuery.data])

  const active = useMemo(
    () =>
      sortActive(alarms.filter((alarm) => isActiveNetworkAlarmStatus(alarm.status))),
    [alarms]
  )
  const history = useMemo(
    () =>
      alarms
        .filter((alarm) => alarm.status === "resolved")
        .sort(
          (left, right) =>
            Date.parse(right.resolvedAt ?? right.createdAt) -
            Date.parse(left.resolvedAt ?? left.createdAt)
        ),
    [alarms]
  )

  const criticalActive = active.filter((alarm) => alarm.severity === "critical").length
  const warningActive = active.filter((alarm) => alarm.severity === "warning").length
  const acknowledged = active.filter((alarm) => alarm.status === "acknowledged").length

  const loadError =
    alarmsQuery.error instanceof Error
      ? alarmsQuery.error.message
      : alarmsQuery.error
        ? "No se pudieron cargar las alarmas"
        : null

  const busy = mutations.acknowledge.isPending || mutations.resolve.isPending

  async function runAction(action: "acknowledge" | "resolve", alarmId: string) {
    setActionError(null)
    try {
      if (action === "acknowledge") await mutations.acknowledge.mutateAsync(alarmId)
      if (action === "resolve") {
        await mutations.resolve.mutateAsync(alarmId)
        setSelectedId(null)
        setNewCriticalIds((current) => {
          if (!current.has(alarmId)) return current
          const next = new Set(current)
          next.delete(alarmId)
          return next
        })
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "No se pudo completar la acción."
      )
    }
  }

  function openDetail(alarmId: string) {
    setSelectedId(alarmId)
    setNewCriticalIds((current) => {
      if (!current.has(alarmId)) return current
      const next = new Set(current)
      next.delete(alarmId)
      return next
    })
    void mutations.seen.mutateAsync(alarmId).catch(() => undefined)
  }

  const selectedAlarm = alarms.find((alarm) => alarm.id === selectedId) ?? null
  const detail = detailQuery.data ?? selectedAlarm
  const selectedDevice = detail ? devicesById.get(detail.deviceId) : undefined

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes network-alarm-enter {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: none; }
        }
        .network-alarm-enter {
          animation: network-alarm-enter 0.35s ease-out;
        }
      `}</style>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Alarmas</h1>
        <p className="text-sm text-muted-foreground">Estado operativo de la red</p>
        <NetworkSubnav current="alarms" />
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Counter label="🔴 Críticas activas" value={criticalActive} tone="critical" />
        <Counter label="🟡 Advertencias activas" value={warningActive} tone="warning" />
        <Counter label="Total activas" value={active.length} />
        <Counter label="Reconocidas" value={acknowledged} />
      </div>

      {loadError && !alarmsQuery.data ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">No se pudieron cargar las alarmas</p>
          <Button
            className="mt-2"
            size="sm"
            variant="outline"
            onClick={() => void alarmsQuery.refetch()}
          >
            Reintentar
          </Button>
        </div>
      ) : null}

      {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">Alarmas activas</h2>
        {alarmsQuery.isPending && !alarmsQuery.data ? (
          <div className="space-y-3">
            <div className="h-28 animate-pulse rounded-lg border bg-muted/40" />
            <div className="h-28 animate-pulse rounded-lg border bg-muted/40" />
          </div>
        ) : active.length === 0 ? (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-6 text-center">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
              No hay alarmas activas
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              La red no tiene incidentes abiertos en este momento.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {active.map((alarm) => (
              <AlarmCard
                key={alarm.id}
                alarm={alarm}
                device={devicesById.get(alarm.deviceId)}
                isNew={newCriticalIds.has(alarm.id)}
                nowMs={nowMs}
                busy={busy}
                onView={() => openDetail(alarm.id)}
                onAcknowledge={() => void runAction("acknowledge", alarm.id)}
                onResolve={() => void runAction("resolve", alarm.id)}
              />
            ))}
          </div>
        )}
      </section>

      {history.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">
            Historial
          </h2>
          <ul className="divide-y rounded-lg border">
            {history.slice(0, 20).map((alarm) => {
              const device = devicesById.get(alarm.deviceId)
              const mttrMs = networkAlarmMttrMs(alarm)
              const duration = formatNetworkHistoryDuration(
                mttrMs == null ? null : Math.floor(mttrMs / 1000)
              )
              return (
                <li
                  key={alarm.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {deviceLabel(device, alarm.deviceId)}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {alarm.severity === "critical" ? "Crítica" : "Advertencia"}
                      </span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{alarm.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatNetworkTimestamp(alarm.createdAt)} →{" "}
                    {formatNetworkTimestamp(alarm.resolvedAt)}
                    {duration !== "abierta" ? ` · ${duration}` : ""}
                  </p>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <Dialog open={selectedId != null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detail?.title ?? "Alarma"}</DialogTitle>
            <DialogDescription>
              {detail ? deviceLabel(selectedDevice, detail.deviceId) : "Detalle de alarma"}
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Severidad:</span>{" "}
                {detail.severity === "critical" ? "Crítica" : "Advertencia"}
              </p>
              <p>
                <span className="text-muted-foreground">Estado:</span> {statusLabel(detail.status)}
              </p>
              {selectedDevice?.managementIp ? (
                <p>
                  <span className="text-muted-foreground">IP:</span> {selectedDevice.managementIp}
                </p>
              ) : null}
              <p className="text-muted-foreground">{detail.message}</p>
              <p className="text-xs text-muted-foreground">
                Apertura: {formatNetworkTimestamp(detail.createdAt)}
              </p>
              {detail.acknowledgedAt ? (
                <p className="text-xs text-muted-foreground">
                  Reconocida: {formatNetworkTimestamp(detail.acknowledgedAt)}
                </p>
              ) : null}
              {detail.resolvedAt ? (
                <p className="text-xs text-muted-foreground">
                  Resolución: {formatNetworkTimestamp(detail.resolvedAt)}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Cargando detalle…</p>
          )}
          <DialogFooter>
            {detail?.status === "open" ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void runAction("acknowledge", detail.id)}
              >
                Reconocer
              </Button>
            ) : null}
            {detail && isActiveNetworkAlarmStatus(detail.status) ? (
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => void runAction("resolve", detail.id)}
              >
                Resolver
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
