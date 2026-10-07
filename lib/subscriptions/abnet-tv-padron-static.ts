import staticRows from "@/lib/subscriptions/abnet-tv-padron.static.json"

import type { AbnetTvPadronSourceRow } from "@/lib/subscriptions/abnet-tv-padron"

export function readAbnetTvPadronStatic(): AbnetTvPadronSourceRow[] {
  return staticRows as AbnetTvPadronSourceRow[]
}
