"use client"

import {
  DEMO_BANNER_HINT,
  DEMO_BANNER_SUBTITLE,
  DEMO_BANNER_TITLE,
} from "@/lib/demo/constants"

export function DemoPlatformBanner() {
  return (
    <div className="border-b border-primary/20 bg-primary/5 px-4 py-2 text-center sm:px-6">
      <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
        {DEMO_BANNER_TITLE}
      </p>
      <p className="text-xs text-foreground/90">{DEMO_BANNER_SUBTITLE}</p>
      <p className="text-[11px] text-muted-foreground">{DEMO_BANNER_HINT}</p>
    </div>
  )
}
