"use client"

import { useCalendarUI } from "@/components/calendario/calendar-ui-provider"
import { cn } from "@/lib/utils"

export function CalendarCriticalPendingBanner() {
  const { criticalPendingTasks, openCriticalPendingPanel } = useCalendarUI()
  const count = criticalPendingTasks.length
  const hasCritical = count > 0

  return (
    <button
      type="button"
      onClick={openCriticalPendingPanel}
      className={cn(
        "w-full rounded-xl border px-5 py-4 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        hasCritical
          ? "border-red-200/80 bg-red-50/90 text-red-950 hover:bg-red-100/80"
          : "border-emerald-200/80 bg-emerald-50/90 text-emerald-950 hover:bg-emerald-100/80"
      )}
    >
      <p className="text-sm font-semibold">
        {hasCritical ? (
          <>
            <span aria-hidden>🔴 </span>
            {count} pendiente{count === 1 ? "" : "s"} crítico
            {count === 1 ? "" : "s"}
          </>
        ) : (
          <>
            <span aria-hidden>✅ </span>
            Sin pendientes críticos
          </>
        )}
      </p>
    </button>
  )
}
