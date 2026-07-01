"use client"

import { formatDispatchOrderBadge, resolveTaskRouteOrder } from "@/lib/tasks/dispatch-order"
import type { Task } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"

type DispatchOrderBadgeProps = {
  task: Pick<Task, "dispatchOrder" | "executionOrder">
  className?: string
  size?: "sm" | "md" | "lg"
}

const SIZE_CLASSES = {
  sm: "min-w-7 px-1.5 py-0.5 text-sm",
  md: "min-w-9 px-2 py-1 text-base",
  lg: "min-w-11 px-2.5 py-1.5 text-lg",
} as const

export function DispatchOrderBadge({
  task,
  className,
  size = "md",
}: DispatchOrderBadgeProps) {
  const order = resolveTaskRouteOrder(task)
  const label = formatDispatchOrderBadge(order)

  if (!label) {
    return null
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10 font-semibold leading-none text-primary",
        SIZE_CLASSES[size],
        className
      )}
      aria-label={`Ruta ${order}`}
      title={`Ruta ${order}`}
    >
      {label}
    </span>
  )
}
