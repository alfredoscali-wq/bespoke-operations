import { PROFILE_PATH } from "@/lib/auth/routes"
import {
  APP_MODULE_DEFINITIONS,
  type AppModuleKey,
  type ModuleVisibilityMap,
} from "@/lib/roles/app-modules"
import { archivoOtNavItem } from "@/lib/navigation/nav-items"
import type { NavGroup, NavItem } from "@/lib/navigation/nav-types"

const GROUP_ORDER: Array<{
  id: NavGroup["id"]
  groupId: AppModuleKey extends never ? never : string
  label?: string
}> = [
  { id: "operations", groupId: "operations" },
  { id: "analysis", groupId: "analysis", label: "Análisis" },
  { id: "rrhh", groupId: "rrhh", label: "RRHH" },
  { id: "system", groupId: "system", label: "Sistema" },
  {
    id: "administration",
    groupId: "administration",
    label: "Administración",
  },
]

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
