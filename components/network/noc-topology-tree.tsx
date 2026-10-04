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
}: {
  nodes: readonly NocTopologyNode[]
  lane?: boolean
}) {
  const count = nodes.length
  if (count === 0) return null
  if (count === 1) {
    return (
      <>
        <span aria-hidden className="h-8 w-px bg-border" />
        <NocTopologyBranch node={nodes[0]} />
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
            <NocTopologyBranch node={child} />
          </div>
        ))}
      </div>
    </>
  )
}

function NocTopologyBranch({ node }: { node: NocTopologyNode }) {
  return (
    <div className="flex flex-col items-center">
      <NocNodeCard node={node} />
      <NocChildrenRow nodes={node.children} />
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
    <div className="flex min-h-full min-w-full justify-center px-8 py-8">
      <div
        className="flex min-w-max flex-col items-center"
        aria-label="Topología global NOC"
      >
        <EmpresaAnchor />
        <NocChildrenRow nodes={forest.roots} lane />
      </div>
    </div>
  )
}
