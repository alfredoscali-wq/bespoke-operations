import { PROFILE_PATH } from "@/lib/auth/routes"
import {
  APP_MODULE_DEFINITIONS,
  type AppModuleKey,
  type ModuleVisibilityMap,
} from "@/lib/roles/app-modules"
import {
  activityNavItem,
  activityTimelineNavItem,
  archivoOtNavItem,
  dayActivityNavItem,
  executiveDailyBriefNavItem,
  workforceMonitorNavItem,
} from "@/lib/navigation/nav-items"
import type { NavGroup, NavItem } from "@/lib/navigation/nav-types"

const GROUP_ORDER: Array<{
  id: NavGroup["id"]
  groupId: AppModuleKey extends never ? never : string
  label?: string
}> = [
  { id: "operations", groupId: "operations" },
  { id: "analysis", groupId: "analysis", label: "📊 Análisis" },
  { id: "rrhh", groupId: "rrhh", label: "RRHH" },
  { id: "system", groupId: "system", label: "Sistema" },
  {
    id: "administration",
    groupId: "administration",
    label: "Administración",
  },
]

/** Ops intelligence tools — same visibility gate as before (history module). */
const OPS_ANALYSIS_NAV_ITEMS: NavItem[] = [
  activityNavItem,
  dayActivityNavItem,
  workforceMonitorNavItem,
  executiveDailyBriefNavItem,
  activityTimelineNavItem,
]

function prependOpsAnalysisItems(group: NavGroup): void {
  const existingHrefs = new Set(group.items.map((item) => item.href))
  const toPrepend = OPS_ANALYSIS_NAV_ITEMS.filter(
    (item) => !existingHrefs.has(item.href)
  )
  group.items = [...toPrepend, ...group.items]
  group.label = group.label ?? "📊 Análisis"
}

export function buildNavGroupsFromModuleVisibility(
  visibility: ModuleVisibilityMap
): NavGroup[] {
  const groups = new Map<string, NavGroup>()

  for (const definition of APP_MODULE_DEFINITIONS) {
    if (!visibility[definition.key]) {
      continue
    }

    const groupKey = definition.groupId
    const existing = groups.get(groupKey)

    if (existing) {
      existing.items.push(definition.navItem)

      if (definition.key === "work_orders") {
        existing.items.push(archivoOtNavItem)
      }

      continue
    }

    const items = [definition.navItem]

    if (definition.key === "work_orders") {
      items.push(archivoOtNavItem)
    }

    groups.set(groupKey, {
      id: groupKey,
      label: definition.groupLabel,
      items,
    })
  }

  // Keep prior permission model: history module unlocks ops analysis entries.
  if (visibility.history) {
    const analysis = groups.get("analysis")
    if (analysis) {
      prependOpsAnalysisItems(analysis)
    } else {
      groups.set("analysis", {
        id: "analysis",
        label: "📊 Análisis",
        items: [...OPS_ANALYSIS_NAV_ITEMS],
      })
    }
  }

  return GROUP_ORDER.flatMap(({ id, groupId, label }) => {
    const group = groups.get(groupId)
    if (!group || group.items.length === 0) {
      return []
    }

    return [
      {
        ...group,
        id,
        label: group.label ?? label,
      },
    ]
  })
}

export function getAllNavItemsFromModuleVisibility(
  visibility: ModuleVisibilityMap
): NavItem[] {
  return buildNavGroupsFromModuleVisibility(visibility).flatMap(
    (group) => group.items
  )
}

export function resolveHomePathFromModuleVisibility(
  visibility: ModuleVisibilityMap
): string {
  if (visibility.dashboard) {
    return "/"
  }

  const firstItem = getAllNavItemsFromModuleVisibility(visibility)[0]
  return firstItem?.href ?? PROFILE_PATH
}
