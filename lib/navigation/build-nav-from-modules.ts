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
  reportsNavItem,
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

/**
 * Ops analysis tools — unlocked by history module (same permission model).
 * Resumen Ejecutivo Diario intentionally omitted from nav (route kept).
 */
const OPS_ANALYSIS_NAV_ITEMS: NavItem[] = [
  dayActivityNavItem,
  activityNavItem,
  workforceMonitorNavItem,
  activityTimelineNavItem,
]

/** Canonical Análisis order for the product architecture. */
const ANALYSIS_NAV_ORDER: readonly string[] = [
  dayActivityNavItem.href,
  reportsNavItem.href,
  activityNavItem.href,
  workforceMonitorNavItem.href,
  activityTimelineNavItem.href,
]

function sortAnalysisNavItems(items: NavItem[]): NavItem[] {
  const byHref = new Map(items.map((item) => [item.href, item]))
  const ordered: NavItem[] = []

  for (const href of ANALYSIS_NAV_ORDER) {
    const item = byHref.get(href)
    if (!item) continue
    ordered.push(item)
    byHref.delete(href)
  }

  for (const item of items) {
    if (!byHref.has(item.href)) continue
    ordered.push(item)
    byHref.delete(item.href)
  }

  return ordered
}

function mergeOpsAnalysisItems(group: NavGroup): void {
  const existingHrefs = new Set(group.items.map((item) => item.href))
  const toAdd = OPS_ANALYSIS_NAV_ITEMS.filter(
    (item) => !existingHrefs.has(item.href)
  )
  group.items = sortAnalysisNavItems([...toAdd, ...group.items])
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
      mergeOpsAnalysisItems(analysis)
    } else {
      groups.set("analysis", {
        id: "analysis",
        label: "📊 Análisis",
        items: sortAnalysisNavItems([...OPS_ANALYSIS_NAV_ITEMS]),
      })
    }
  } else if (groups.has("analysis")) {
    const analysis = groups.get("analysis")!
    analysis.items = sortAnalysisNavItems(analysis.items)
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
