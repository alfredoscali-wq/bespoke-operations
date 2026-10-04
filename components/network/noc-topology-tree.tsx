"use client"

import type { NocHealthState, NocTopologyForest, NocTopologyNode } from "@/lib/network/noc/types"
import { cn } from "@/lib/utils"

function healthClass(health: NocHealthState | null): string {
  if (health === "online") return "border-emerald-500/70 bg-emerald-500/10"
  if (health === "attention") return "border-amber-500/70 bg-amber-500/10"
  if (health === "offline") return "border-red-500/70 bg-red-500/10"
  return "border-border bg-background"
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

function NocNodeCard({ node }: { node: NocTopologyNode }) {
  const showIp = Boolean(node.ipAddress) && node.ipAddress !== node.label
  return (
    <div
      className={cn(
        "w-44 rounded-lg border px-3 py-3 text-center shadow-sm",
        healthClass(node.health)
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

function NocTopologyBranch({ node }: { node: NocTopologyNode }) {
  const childCount = node.children.length
  return (
    <div className="flex flex-col items-center">
      <NocNodeCard node={node} />
      {childCount === 1 ? (
        <>
          <span aria-hidden className="h-8 w-px bg-border" />
          <NocTopologyBranch node={node.children[0]} />
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
                <NocTopologyBranch node={child} />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

export function NocTopologyTree({ forest }: { forest: NocTopologyForest }) {
  if (forest.roots.length === 0) {
    return (
      <p className="p-8 text-center text-sm text-muted-foreground">
        Todavía no hay una topología curada
      </p>
    )
  }
  return (
    <div className="flex min-w-full justify-center overflow-x-auto py-8 pl-8 pr-8">
      <div
        className="flex min-w-max items-start justify-center gap-16"
        aria-label="Topología NOC"
      >
        {forest.roots.map((root) => (
          <NocTopologyBranch key={root.deviceId} node={root} />
        ))}
      </div>
    </div>
  )
}
