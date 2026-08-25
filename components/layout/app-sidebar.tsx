"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, ChevronLeft, ChevronRight, Plus, X } from "lucide-react"

import { useOperationalProfile } from "@/components/operations/operational-profile-provider"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { BESPOKE_LOGO_SRC } from "@/lib/branding/logo"
import type { NavGroup, NavItem } from "@/lib/navigation"
import {
  SIDEBAR_AREA_META,
  SIDEBAR_SECTIONS_STORAGE_KEY,
  isNavItemActive,
  mergeSidebarSectionState,
  parseSidebarSectionState,
  resolveSidebarAreaId,
  serializeSidebarSectionState,
  type SidebarAreaId,
} from "@/lib/navigation/sidebar-areas"
import { cn } from "@/lib/utils"

type AppSidebarProps = {
  collapsed: boolean
  mobileOpen: boolean
  onToggleCollapse: () => void
  onExpandSidebar: () => void
  onCloseMobile: () => void
}

function areaColor(areaId: string): string {
  return `var(--sidebar-area-${areaId})`
}

function areaSoft(areaId: string): string {
  return `var(--sidebar-area-${areaId}-soft)`
}

function NavLink({
  item,
  pathname,
  siblingHrefs,
  areaId,
  onCloseMobile,
}: {
  item: NavItem
  pathname: string
  siblingHrefs: readonly string[]
  areaId: string
  onCloseMobile: () => void
}) {
  const isActive = isNavItemActive(pathname, item.href, siblingHrefs)
  const Icon = item.icon
  const accent = areaColor(areaId)

  return (
    <Link
      href={item.href}
      onClick={onCloseMobile}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-[13px] transition-[background-color,color,box-shadow] duration-200",
        isActive
          ? "font-semibold text-slate-800"
          : "font-medium text-slate-600 hover:bg-[color-mix(in_oklab,var(--area-accent)_8%,white)] hover:text-slate-800"
      )}
      style={
        {
          ["--area-accent" as string]: accent,
          ...(isActive
            ? {
                backgroundColor: `color-mix(in oklab, ${accent} 11%, white)`,
                boxShadow: `inset 3px 0 0 ${accent}, 0 1px 2px rgb(15 23 42 / 0.05)`,
              }
            : undefined),
        }
      }
    >
      <Icon
        className="size-4 shrink-0 transition-colors duration-200"
        style={{ color: accent }}
      />
      <span className="truncate">{item.title}</span>
    </Link>
  )
}

function SidebarBrand({
  compact,
  homePath,
  onCloseMobile,
}: {
  compact: boolean
  homePath: string
  onCloseMobile: () => void
}) {
  return (
    <Link
      href={homePath}
      className="flex items-center justify-center rounded-lg transition-opacity duration-200 hover:opacity-90"
      onClick={onCloseMobile}
    >
      <img
        src={BESPOKE_LOGO_SRC}
        alt="Bespoke Operations"
        className={cn(
          "shrink-0 object-contain object-center",
          compact ? "h-11 w-auto max-w-[60px]" : "h-16 w-auto max-w-[184px]"
        )}
      />
    </Link>
  )
}

function AreaSection({
  group,
  pathname,
  open,
  onToggle,
  onCloseMobile,
}: {
  group: NavGroup
  pathname: string
  open: boolean
  onToggle: () => void
  onCloseMobile: () => void
}) {
  const areaId = group.id as SidebarAreaId
  const meta = SIDEBAR_AREA_META[areaId] ?? {
    id: areaId,
    label: group.label ?? group.id,
    icon: SIDEBAR_AREA_META.operations.icon,
  }
  const AreaIcon = meta.icon
  const accent = areaColor(areaId)
  const siblingHrefs = group.items.map((item) => item.href)
  const hasActive = siblingHrefs.some((href) =>
    isNavItemActive(pathname, href, siblingHrefs)
  )

  return (
    <section
      className="rounded-xl px-1.5 py-1.5 transition-[background-color,box-shadow] duration-200"
      style={{
        backgroundColor: open ? areaSoft(areaId) : `color-mix(in oklab, ${areaSoft(areaId)} 70%, white)`,
        boxShadow: open
          ? `inset 3px 0 0 ${accent}, 0 1px 2px rgb(15 23 42 / 0.05)`
          : `inset 3px 0 0 color-mix(in oklab, ${accent} 40%, white), 0 1px 2px rgb(15 23 42 / 0.03)`,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-200",
          open ? "font-bold" : "font-medium text-slate-500 hover:text-slate-700"
        )}
        style={open ? { color: accent } : undefined}
      >
        <AreaIcon className="size-3.5 shrink-0" style={{ color: accent }} />
        <span className="min-w-0 flex-1 truncate text-[11px] tracking-[0.12em] uppercase">
          {meta.label}
        </span>
        {hasActive ? (
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
        ) : null}
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-200",
            open ? "rotate-0" : "-rotate-90",
            !open && "text-slate-400"
          )}
          style={open ? { color: accent } : undefined}
        />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-0.5 pt-0.5 pb-1">
            {group.items.map((item) => (
              <NavLink
                key={`${group.id}-${item.href}-${item.title}`}
                item={item}
                pathname={pathname}
                siblingHrefs={siblingHrefs}
                areaId={areaId}
                onCloseMobile={onCloseMobile}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function AppSidebar({
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onExpandSidebar,
  onCloseMobile,
}: AppSidebarProps) {
  const pathname = usePathname()
  const { navGroups, profile, homePath } = useOperationalProfile()
  const compact = collapsed && !mobileOpen
  const areaKey = navGroups.map((group) => group.id).join("|")
  const areaIds = useMemo(
    () => (areaKey ? areaKey.split("|") : []),
    [areaKey]
  )
  const activeAreaId = resolveSidebarAreaId(pathname)
  const [openById, setOpenById] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const stored =
      typeof window === "undefined"
        ? {}
        : parseSidebarSectionState(
            window.localStorage.getItem(SIDEBAR_SECTIONS_STORAGE_KEY)
          )
    setOpenById(
      mergeSidebarSectionState({
        stored,
        areaIds,
        activeAreaId: null,
      })
    )
  }, [areaIds])

  useEffect(() => {
    if (!activeAreaId || (areaIds.length > 0 && !areaIds.includes(activeAreaId))) {
      return
    }
    setOpenById((current) => {
      if (current[activeAreaId]) return current
      const next = { ...current, [activeAreaId]: true }
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          SIDEBAR_SECTIONS_STORAGE_KEY,
          serializeSidebarSectionState(next)
        )
      }
      return next
    })
  }, [activeAreaId, areaIds])

  function persist(next: Record<string, boolean>) {
    setOpenById(next)
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      SIDEBAR_SECTIONS_STORAGE_KEY,
      serializeSidebarSectionState(next)
    )
  }

  function toggleSection(id: string) {
    persist({ ...openById, [id]: !openById[id] })
  }

  function openSection(id: string) {
    persist({ ...openById, [id]: true })
  }

  const sidebarContent = (
    <>
      <div
        className={cn(
          "relative flex shrink-0 items-center px-3",
          compact ? "h-[4.75rem] justify-center py-2" : "gap-2 py-3"
        )}
      >
        <SidebarBrand
          compact={compact}
          homePath={homePath}
          onCloseMobile={onCloseMobile}
        />

        {!compact && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto hidden shrink-0 text-slate-400 hover:text-slate-600 lg:inline-flex"
            onClick={onToggleCollapse}
            aria-label="Contraer menú"
          >
            <ChevronLeft className="size-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-3 right-2 shrink-0 text-slate-400 lg:hidden"
          onClick={onCloseMobile}
          aria-label="Cerrar menú"
        >
          <X className="size-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2.5 py-1">
        {compact ? (
          <nav className="flex flex-col items-center gap-2">
            {navGroups.map((group) => {
              const areaId = group.id as SidebarAreaId
              const meta = SIDEBAR_AREA_META[areaId]
              if (!meta) return null
              const AreaIcon = meta.icon
              const isActiveArea = activeAreaId === areaId
              return (
                <Tooltip key={group.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={meta.label}
                      onClick={() => {
                        onExpandSidebar()
                        openSection(areaId)
                      }}
                      className={cn(
                        "flex size-10 items-center justify-center rounded-xl transition-[background-color,box-shadow,color] duration-200",
                        !isActiveArea && "hover:bg-[color-mix(in_oklab,var(--area-accent)_10%,white)]"
                      )}
                      style={
                        {
                          ["--area-accent" as string]: areaColor(areaId),
                          color: areaColor(areaId),
                          ...(isActiveArea
                            ? {
                                backgroundColor: areaSoft(areaId),
                                boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${areaColor(areaId)} 22%, white)`,
                              }
                            : undefined),
                        }
                      }
                    >
                      <AreaIcon className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{meta.label}</TooltipContent>
                </Tooltip>
              )
            })}
          </nav>
        ) : (
          <nav className="flex flex-col gap-2.5 pb-2">
            {navGroups.map((group) => (
              <AreaSection
                key={group.id}
                group={group}
                pathname={pathname}
                open={openById[group.id] ?? true}
                onToggle={() => toggleSection(group.id)}
                onCloseMobile={onCloseMobile}
              />
            ))}
          </nav>
        )}
      </ScrollArea>

      {profile === "ventas" && (
        <div className="shrink-0 p-3">
          <Button
            asChild
            className={cn(
              "w-full gap-2 font-semibold",
              compact && "size-9 px-0"
            )}
            size={compact ? "icon-sm" : "default"}
          >
            <Link href="/tareas" onClick={onCloseMobile} title="Nueva Instalación">
              <Plus className="size-4 shrink-0" />
              {!compact && <span>Nueva Instalación</span>}
            </Link>
          </Button>
        </div>
      )}

      {compact && (
        <div className="hidden shrink-0 p-2 lg:block">
          <Button
            variant="ghost"
            size="icon-sm"
            className="mx-auto text-slate-400 hover:text-slate-600"
            onClick={onToggleCollapse}
            aria-label="Expandir menú"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </>
  )

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] lg:hidden"
          onClick={onCloseMobile}
          aria-label="Cerrar menú lateral"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200/80 bg-[#f7f8fa] text-slate-800 transition-[width,transform] duration-200 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          compact ? "lg:w-[72px]" : "lg:w-64"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
