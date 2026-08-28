import { getAllNavItemsFromModuleVisibility } from "@/lib/navigation/build-nav-from-modules"
import type { NavItem } from "@/lib/navigation/nav-types"
import {
  SIDEBAR_AREA_META,
  arrangeNavItemsIntoAreas,
  type SidebarAreaId,
} from "@/lib/navigation/sidebar-areas"
import {
  createFullModuleVisibility,
  resolveModuleKeyFromPathname,
  type AppModuleKey,
  type ModuleVisibilityMap,
} from "@/lib/roles/app-modules"
import type { LucideIcon } from "lucide-react"

export type AreaConfigScreen = {
  id: string
  title: string
  icon: LucideIcon
  moduleKey: AppModuleKey
}

export type AreaConfigSidebarGroup = {
  id: SidebarAreaId
  label: string
  icon: LucideIcon
  screens: AreaConfigScreen[]
}

function mapNavItemToScreen(item: NavItem): AreaConfigScreen | null {
  const moduleKey = resolveModuleKeyFromPathname(item.href)
  if (!moduleKey) return null
  return {
    id: item.href,
    title: item.title,
    icon: item.icon,
    moduleKey,
  }
}

/**
 * Sidebar-aligned screen tree for Áreas configuration.
 * Derived from the same nav builder used by the app menu — not a manual duplicate list.
 */
export function buildAreaConfigSidebarGroups(): AreaConfigSidebarGroup[] {
  const visibility = createFullModuleVisibility()
  const items = getAllNavItemsFromModuleVisibility(visibility)
  const areas = arrangeNavItemsIntoAreas(items)

  return areas.flatMap((area) => {
    const areaId = area.id as SidebarAreaId
    const meta = SIDEBAR_AREA_META[areaId]
    if (!meta) return []

    const screens: AreaConfigScreen[] = []
    const seen = new Set<string>()
    for (const item of area.items) {
      const screen = mapNavItemToScreen(item)
      if (!screen || seen.has(screen.id)) continue
      seen.add(screen.id)
      screens.push(screen)
    }

    if (screens.length === 0) return []

    return [
      {
        id: areaId,
        label: meta.label,
        icon: meta.icon,
        screens,
      },
    ]
  })
}

export function uniqueModuleKeysForScreens(
  screens: readonly AreaConfigScreen[]
): AppModuleKey[] {
  return [...new Set(screens.map((screen) => screen.moduleKey))]
}

export function getSidebarGroupSelectionState(
  screens: readonly AreaConfigScreen[],
  visibility: ModuleVisibilityMap
): "all" | "some" | "none" {
  const keys = uniqueModuleKeysForScreens(screens)
  const enabledCount = keys.filter((key) => visibility[key]).length
  if (enabledCount === 0) return "none"
  if (enabledCount === keys.length) return "all"
  return "some"
}

export function applySidebarGroupSelection(
  visibility: ModuleVisibilityMap,
  screens: readonly AreaConfigScreen[],
  enabled: boolean
): ModuleVisibilityMap {
  const keys = uniqueModuleKeysForScreens(screens)
  const next = { ...visibility }
  for (const key of keys) {
    next[key] = enabled
  }
  return next
}

export function applyModuleSelection(
  visibility: ModuleVisibilityMap,
  moduleKey: AppModuleKey,
  enabled: boolean
): ModuleVisibilityMap {
  return {
    ...visibility,
    [moduleKey]: enabled,
  }
}
