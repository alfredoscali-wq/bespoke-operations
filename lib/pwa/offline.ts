/**
 * PWA 2.0 — modo offline (estructura reservada).
 * No implementado en Sprint PWA 1.0.
 */

import { PWA_FUTURE_FEATURES } from "@/lib/pwa/config"

export type PwaOfflineCapabilities = {
  enabled: boolean
  canServeShell: boolean
  canQueueMutations: boolean
}

export function getPwaOfflineCapabilities(): PwaOfflineCapabilities {
  return {
    enabled: PWA_FUTURE_FEATURES.offline,
    canServeShell: false,
    canQueueMutations: false,
  }
}

/** Hook futuro para detectar conectividad y activar cola de sync. */
export function isPwaOfflineModeAvailable(): boolean {
  return false
}
