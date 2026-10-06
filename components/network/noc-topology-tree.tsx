"use client"

import type { NocAlarmOverlay } from "@/lib/network/noc/alarm-visual"
import type { NocHealthState, NocTopologyForest, NocTopologyNode } from "@/lib/network/noc/types"
import { cn } from "@/lib/utils"

export type { NocAlarmOverlay }

function healthClass(health: NocHealthState | null): string {
  if (health === "online") return "border-emerald-500/70 bg-emerald-500/10"
  if (health === "attention") return "border-amber-500/70 bg-amber-500/10"
  if (health === "offline") return "border-red-500/70 bg-red-500/10"
  return "border-border bg-background"
}

function overlayClass(overlay: NocAlarmOverlay | undefined): string | null {
  if (overlay?.severity === "critical") {
    return "border-red-600 bg-red-600/20 ring-2 ring-red-600/80"
  }
  if (overlay?.severity === "warning") {
    return "border-amber-500 bg-amber-400/20 ring-2 ring-amber-500/70"
  }
  return null
}

function healthDotClass(health: NocHealthState | null): string {
  if (health === "online") return "bg-emerald-500"
  if (health === "attention") return "bg-amber-500"
  if (health === "offline") return "bg-red-500"
  return "bg-slate-400"
}

function healthLabel(health: NocHealthState | null): string {
  if (health === "online") return "Online"
  if (health === "attention") return "Atención"
  if (health === "offline") return "Offline"
  return "Sin estado"
}

function NocNodeCard({
  node,
  overlay,
  selected,
  onSelect,
}: {
  node: NocTopologyNode
  overlay?: NocAlarmOverlay
  selected?: boolean
  onSelect?: (deviceId: string) => void
}) {
  const showIp = Boolean(node.ipAddress) && node.ipAddress !== node.label
  const visual = overlayClass(overlay) ?? healthClass(node.health)
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect?.(node.deviceId)}
      className={cn(
        "w-44 rounded-lg border px-3 py-3 text-center shadow-sm",
        visual,
        overlay?.isNew && overlay.severity === "critical" && "noc-alarm-pulse",
        selected && "ring-offset-2 ring-offset-background"
      )}
    >
      <p className="whitespace-normal break-words text-sm font-semibold leading-snug">
        {node.label}
      </p>
      {showIp ? (
        <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
          {node.ipAddress}
        </p>
      ) : null}
      <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium">
        <span
          className={cn(
            "inline-block size-2.5 shrink-0 rounded-full",
            healthDotClass(node.health)
          )}
        />
        {healthLabel(node.health)}
      </p>
      {overlay ? (
        <p
          className={cn(
            "mt-1.5 text-[10px] font-semibold uppercase tracking-wide",
            overlay.severity === "critical" ? "text-red-700" : "text-amber-700"
          )}
        >
          {overlay.severity === "critical" ? "ALARMA CRÍTICA" : "ADVERTENCIA"}
          {overlay.isNew ? (
            <span className="noc-nueva-badge ml-1 rounded bg-red-600 px-1 py-px text-[9px] text-white">
              NUEVA
            </span>
          ) : null}
        </p>
      ) : null}
    </button>
  )
}

function EmpresaAnchor() {
  return (
    <div className="min-w-44 rounded-lg border-2 border-foreground/25 bg-muted/50 px-6 py-3 text-center shadow-sm">
      <p className="text-sm font-semibold tracking-wide">RED / EMPRESA</p>
    </div>
  )
}

function ChildConnector({
  index,
  count,
}: {
  index: number
  count: number
}) {
  if (count <= 1) return null
  const isFirst = index === 0
  const isLast = index === count - 1
  return (
    <>
      <span
        aria-hidden
        className={cn(
          "absolute top-0 h-px bg-border",
          isFirst && "right-0 left-1/2",
          isLast && "left-0 right-1/2",
          !isFirst && !isLast && "inset-x-0"
        )}
      />
      <span aria-hidden className="h-5 w-px bg-border" />
    </>
  )
}

function NocChildrenRow({
  nodes,
  lane,
  alarmByDeviceId,
  selectedDeviceId,
  onSelectDevice,
}: {
  nodes: readonly NocTopologyNode[]
  lane?: boolean
  alarmByDeviceId?: ReadonlyMap<string, NocAlarmOverlay>
  selectedDeviceId?: string | null
  onSelectDevice?: (deviceId: string) => void
}) {
  const count = nodes.length
  if (count === 0) return null
  if (count === 1) {
    return (
      <>
        <span aria-hidden className="h-8 w-px bg-border" />
        <NocTopologyBranch
          node={nodes[0]}
          alarmByDeviceId={alarmByDeviceId}
          selectedDeviceId={selectedDeviceId}
          onSelectDevice={onSelectDevice}
        />
      </>
    )
  }
  return (
    <>
      <span aria-hidden className="h-5 w-px bg-border" />
      <div className="flex items-start">
        {nodes.map((child, index) => (
          <div
            key={child.deviceId}
            className={cn(
              "relative flex flex-col items-center",
              lane ? "px-10" : "px-4"
            )}
          >
            <ChildConnector index={index} count={count} />
            <NocTopologyBranch
              node={child}
              alarmByDeviceId={alarmByDeviceId}
              selectedDeviceId={selectedDeviceId}
              onSelectDevice={onSelectDevice}
            />
          </div>
        ))}
      </div>
    </>
  )
}

function NocTopologyBranch({
  node,
  alarmByDeviceId,
  selectedDeviceId,
  onSelectDevice,
}: {
  node: NocTopologyNode
  alarmByDeviceId?: ReadonlyMap<string, NocAlarmOverlay>
  selectedDeviceId?: string | null
  onSelectDevice?: (deviceId: string) => void
}) {
  return (
    <div className="flex flex-col items-center">
      <NocNodeCard
        node={node}
        overlay={alarmByDeviceId?.get(node.deviceId)}
        selected={selectedDeviceId === node.deviceId}
        onSelect={onSelectDevice}
      />
      <NocChildrenRow
        nodes={node.children}
        alarmByDeviceId={alarmByDeviceId}
        selectedDeviceId={selectedDeviceId}
        onSelectDevice={onSelectDevice}
      />
    </div>
  )
}

export function NocTopologyTree({
  forest,
  alarmByDeviceId,
  selectedDeviceId,
  onSelectDevice,
}: {
  forest: NocTopologyForest
  alarmByDeviceId?: ReadonlyMap<string, NocAlarmOverlay>
  selectedDeviceId?: string | null
  onSelectDevice?: (deviceId: string) => void
}) {
  if (forest.roots.length === 0) {
    return (
      <p className="p-8 text-center text-sm text-muted-foreground">
        Todavía no hay una topología curada
      </p>
    )
  }
  return (
    <div className="flex min-h-full min-w-full justify-center px-8 py-8">
      <div
        className="flex min-w-max flex-col items-center"
        aria-label="Topología global NOC"
      >
        <EmpresaAnchor />
        <NocChildrenRow
          nodes={forest.roots}
          lane
          alarmByDeviceId={alarmByDeviceId}
          selectedDeviceId={selectedDeviceId}
          onSelectDevice={onSelectDevice}
        />
      </div>
    </div>
  )
}
