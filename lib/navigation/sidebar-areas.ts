import {
  Cable,
  ChartNoAxesCombined,
  Contact,
  LayoutDashboard,
  Settings,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react"

import type { NavGroup, NavItem } from "@/lib/navigation/nav-types"

export const SIDEBAR_SECTIONS_STORAGE_KEY = "bespoke-sidebar-sections"

export const SIDEBAR_AREA_IDS = [
  "operations",
  "customers",
  "isp",
  "field",
  "analysis",
  "administration",
  "rrhh",
  "system",
] as const

export type SidebarAreaId = (typeof SIDEBAR_AREA_IDS)[number]

export type SidebarAreaMeta = {
  id: SidebarAreaId
  label: string
  icon: LucideIcon
}

export const SIDEBAR_AREA_META: Record<SidebarAreaId, SidebarAreaMeta> = {
  operations: {
    id: "operations",
    label: "Operaciones",
    icon: LayoutDashboard,
  },
  customers: {
    id: "customers",
    label: "Clientes",
    icon: Contact,
  },
  isp: {
    id: "isp",
    label: "ISP",
    icon: Cable,
  },
  field: {
    id: "field",
    label: "Campo",
    icon: UsersRound,
  },
  analysis: {
    id: "analysis",
    label: "Análisis",
    icon: ChartNoAxesCombined,
  },
  administration: {
    id: "administration",
    label: "Administración",
    icon: WalletCards,
  },
  rrhh: {
    id: "rrhh",
    label: "RRHH",
    icon: UsersRound,
  },
  system: {
    id: "system",
    label: "Sistema",
    icon: Settings,
  },
}

const AREA_ITEM_HREFS: Record<SidebarAreaId, readonly string[]> = {
  operations: [
    "/",
    "/operations/calendar",
    "/operations/planificacion",
    "/obras",
    "/tareas",
    "/operations/archivo-ot",
  ],
  customers: ["/clientes", "/clientes-360", "/atencion-cliente"],
  isp: ["/servicios", "/conexiones"],
  field: ["/cuadrillas", "/contratistas", "/materiales", "/evidencias"],
  analysis: [
    "/activity/executive-center",
    "/activity",
    "/activity/workforce-monitor",
    "/activity/jornada",
    "/reportes/operativos",
    "/activity/cuadrillas",
  ],
  administration: [
    "/tesoreria",
    "/subscriptions",
    "/gestion-comercial/oportunidades",
    "/activity/timeline",
    "/mantenimiento",
  ],
  rrhh: ["/rrhh", "/novedades", "/operations/availability"],
  system: [
    "/configuracion",
    "/usuarios",
    "/dispositivos",
    "/historial",
  ],
}

const PATH_AREA_PREFIXES: Array<{ prefix: string; area: SidebarAreaId }> = [
  { prefix: "/clientes-360", area: "customers" },
  { prefix: "/clientes", area: "customers" },
  { prefix: "/atencion-cliente", area: "customers" },
  { prefix: "/servicios", area: "isp" },
  { prefix: "/conexiones", area: "isp" },
  { prefix: "/activity/executive-center", area: "analysis" },
  { prefix: "/activity/workforce-monitor", area: "analysis" },
  { prefix: "/activity/jornada", area: "analysis" },
  { prefix: "/activity/cuadrillas", area: "analysis" },
  { prefix: "/activity/timeline", area: "administration" },
  { prefix: "/activity/daily-brief", area: "analysis" },
  { prefix: "/activity", area: "analysis" },
  { prefix: "/operations/calendar", area: "operations" },
  { prefix: "/operations/planificacion", area: "operations" },
  { prefix: "/operations/archivo-ot", area: "operations" },
  { prefix: "/operations/availability", area: "rrhh" },
  { prefix: "/tareas", area: "operations" },
  { prefix: "/obras", area: "operations" },
  { prefix: "/cuadrillas", area: "field" },
  { prefix: "/contratistas", area: "field" },
  { prefix: "/materiales", area: "field" },
  { prefix: "/evidencias", area: "field" },
  { prefix: "/reportes", area: "analysis" },
  { prefix: "/tesoreria", area: "administration" },
  { prefix: "/subscriptions", area: "administration" },
  { prefix: "/gestion-comercial", area: "administration" },
  { prefix: "/mantenimiento", area: "administration" },
  { prefix: "/administracion", area: "administration" },
  { prefix: "/rrhh", area: "rrhh" },
  { prefix: "/novedades", area: "rrhh" },
  { prefix: "/configuracion", area: "system" },
  { prefix: "/usuarios", area: "system" },
  { prefix: "/dispositivos", area: "system" },
  { prefix: "/historial", area: "system" },
]

const HREF_AREA = new Map<string, SidebarAreaId>()
const HREF_ORDER = new Map<string, number>()

for (const areaId of SIDEBAR_AREA_IDS) {
  AREA_ITEM_HREFS[areaId].forEach((href, index) => {
    HREF_AREA.set(href, areaId)
    HREF_ORDER.set(href, index)
  })
}

function pathMatchesHref(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname === ""
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function resolveSidebarAreaId(
  pathname: string
): SidebarAreaId | null {
  if (pathname === "/" || pathname === "") return "operations"

  let best: { prefix: string; area: SidebarAreaId } | null = null
  for (const candidate of PATH_AREA_PREFIXES) {
    if (!pathMatchesHref(pathname, candidate.prefix)) continue
    if (!best || candidate.prefix.length > best.prefix.length) {
      best = candidate
    }
  }
  return best?.area ?? null
}

export function resolveAreaIdForNavHref(href: string): SidebarAreaId {
  return HREF_AREA.get(href) ?? resolveSidebarAreaId(href) ?? "operations"
}

export function isNavHrefActive(pathname: string, href: string): boolean {
  return pathMatchesHref(pathname, href)
}

export function isNavItemActive(
  pathname: string,
  href: string,
  siblingHrefs: readonly string[]
): boolean {
  if (!pathMatchesHref(pathname, href)) return false
  return !siblingHrefs.some(
    (other) =>
      other !== href &&
      other.length > href.length &&
      pathMatchesHref(pathname, other)
  )
}

export function findActiveNavHref(
  pathname: string,
  items: readonly Pick<NavItem, "href">[]
): string | null {
  const matches = items
    .map((item) => item.href)
    .filter((href) => pathMatchesHref(pathname, href))
    .sort((left, right) => right.length - left.length)
  return matches[0] ?? null
}

export function arrangeNavItemsIntoAreas(items: readonly NavItem[]): NavGroup[] {
  const buckets = new Map<SidebarAreaId, NavItem[]>()
  const seen = new Set<string>()

  for (const item of items) {
    const key = `${item.href}::${item.title}`
    if (seen.has(key)) continue
    seen.add(key)
    const areaId = resolveAreaIdForNavHref(item.href)
    const bucket = buckets.get(areaId) ?? []
    bucket.push(item)
    buckets.set(areaId, bucket)
  }

  return SIDEBAR_AREA_IDS.flatMap((areaId) => {
    const areaItems = buckets.get(areaId)
    if (!areaItems || areaItems.length === 0) return []

    areaItems.sort((left, right) => {
      const leftOrder = HREF_ORDER.get(left.href) ?? Number.MAX_SAFE_INTEGER
      const rightOrder = HREF_ORDER.get(right.href) ?? Number.MAX_SAFE_INTEGER
      if (leftOrder !== rightOrder) return leftOrder - rightOrder
      return left.title.localeCompare(right.title, "es")
    })

    const meta = SIDEBAR_AREA_META[areaId]
    return [
      {
        id: areaId,
        label: meta.label,
        items: areaItems,
      },
    ]
  })
}

export function parseSidebarSectionState(
  raw: string | null | undefined
): Record<string, boolean> {
  if (!raw?.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {}
    }
    const result: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") result[key] = value
    }
    return result
  } catch {
    return {}
  }
}

export function serializeSidebarSectionState(
  state: Record<string, boolean>
): string {
  return JSON.stringify(state)
}

export function mergeSidebarSectionState(input: {
  stored: Record<string, boolean>
  areaIds: readonly string[]
  activeAreaId: string | null
}): Record<string, boolean> {
  const next: Record<string, boolean> = {}
  for (const id of input.areaIds) {
    next[id] = input.stored[id] ?? true
  }
  if (input.activeAreaId && input.areaIds.includes(input.activeAreaId)) {
    next[input.activeAreaId] = true
  }
  return next
}

