import type { ResolvedLocation } from "@/lib/location/types"

const resolutionCache = new Map<string, ResolvedLocation>()

export function normalizeResolutionCacheKey(value: string): string {
  return value.trim().toLowerCase()
}

export function getCachedResolution(
  sharedLocation: string
): ResolvedLocation | undefined {
  return resolutionCache.get(normalizeResolutionCacheKey(sharedLocation))
}

export function setCachedResolution(
  sharedLocation: string,
  resolved: ResolvedLocation
): void {
  resolutionCache.set(normalizeResolutionCacheKey(sharedLocation), resolved)
}

export function clearResolutionCache(): void {
  resolutionCache.clear()
}

export function getResolutionCacheSize(): number {
  return resolutionCache.size
}
