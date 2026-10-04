"use client"

import type { ReactNode } from "react"

import {
  NETWORK_DEVICE_STATUS_LABELS,
} from "@/lib/network/labels"
import type {
  CuratedTopologyForest,
  CuratedTopologyNode,
} from "@/lib/network/topology/types"
import { cn } from "@/lib/utils"

function statusDotClass(status: string | null | undefined): string {
  if (status === "online") return "bg-emerald-500"
  if (status === "offline") return "bg-red-500"
  if (status === "degraded") return "bg-amber-500"
  return "bg-slate-400"
}

function statusLabel(status: string | null | undefined): string | null {
  if (
    status === "online" ||
    status === "offline" ||
    status === "degraded" ||
    status === "unknown"
  ) {
    return NETWORK_DEVICE_STATUS_LABELS[status]
  }
  return null
}

function CuratedTopologyNodeCard({
  node,
  selected,
  isRoot,
  onSelect,
}: {
  node: CuratedTopologyNode
  selected?: boolean
  isRoot?: boolean
  onSelect?: (deviceId: string) => void
}) {
  const statusText = statusLabel(node.status)
  const showIp =
    Boolean(node.ipAddress) && node.ipAddress !== node.label
  const className = cn(
    "w-44 rounded-lg border px-3 py-2.5 text-center align-top shadow-sm transition-colors",
    isRoot ? "border-foreground/30 bg-background" : "border-border bg-background",
    selected
      ? "border-foreground bg-muted/50 shadow-md ring-1 ring-foreground/15"
      : onSelect
        ? "hover:border-foreground/40"
        : null
  )
  const inner = (
    <>
      <p className="whitespace-normal break-words text-center text-sm font-semibold leading-snug">
        {node.label}
      </p>
      {showIp ? (
        <p className="mt-1 text-center text-[11px] leading-tight text-muted-foreground">
          {node.ipAddress}
        </p>
      ) : null}
      {statusText ? (
        <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] leading-tight text-muted-foreground">
          <span
            className={cn(
              "inline-block size-2 shrink-0 rounded-full",
              statusDotClass(node.status)
            )}
          />
          {statusText}
        </p>
      ) : null}
    </>
  )
  if (onSelect) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        className={className}
        onClick={() => onSelect(node.deviceId)}
      >
        {inner}
      </button>
    )
  }
  return <div className={className}>{inner}</div>
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

function CuratedTopologyBranch({
  node,
  isRoot,
  actions,
  selectedDeviceId,
  onSelectDevice,
}: {
  node: CuratedTopologyNode
  isRoot?: boolean
  actions?: (node: CuratedTopologyNode) => ReactNode
  selectedDeviceId?: string | null
  onSelectDevice?: (deviceId: string) => void
}) {
  const selected = selectedDeviceId === node.deviceId
  const childCount = node.children.length

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {selected && actions ? (
          <div className="absolute left-full top-0 z-10 ml-2">
            {actions(node)}
          </div>
        ) : null}
        <CuratedTopologyNodeCard
          node={node}
          isRoot={isRoot}
          selected={selected}
          onSelect={onSelectDevice}
        />
      </div>
      {childCount === 1 ? (
        <>
          <span aria-hidden className="h-8 w-px bg-border" />
          <CuratedTopologyBranch
            node={node.children[0]}
            actions={actions}
            selectedDeviceId={selectedDeviceId}
            onSelectDevice={onSelectDevice}
          />
        </>
      ) : null}
      {childCount > 1 ? (
        <>
          <span aria-hidden className="h-5 w-px bg-border" />
          <div className="flex items-start">
            {node.children.map((child, index) => (
              <div
                key={child.deviceId}
                className="relative flex flex-col items-center px-4"
              >
                <ChildConnector index={index} count={childCount} />
                <CuratedTopologyBranch
                  node={child}
                  actions={actions}
                  selectedDeviceId={selectedDeviceId}
                  onSelectDevice={onSelectDevice}
                />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

export function CuratedTopologyTree({
  forest,
  actions,
  selectedDeviceId,
  onSelectDevice,
}: {
  forest: CuratedTopologyForest
  actions?: (node: CuratedTopologyNode) => ReactNode
  selectedDeviceId?: string | null
  onSelectDevice?: (deviceId: string) => void
}) {
  return (
    <div className="flex min-h-[28rem] min-w-full justify-center overflow-x-auto py-8 pl-8 pr-56">
      <div
        className="flex min-w-max items-start justify-center gap-16"
        aria-label="Topología curada"
      >
        {forest.roots.map((root) => (
          <CuratedTopologyBranch
            key={root.deviceId}
            node={root}
            isRoot
            actions={actions}
            selectedDeviceId={selectedDeviceId}
            onSelectDevice={onSelectDevice}
          />
        ))}
      </div>
    </div>
  )
}
