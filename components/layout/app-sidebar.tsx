"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
} from "lucide-react"

import { useOperationalProfile } from "@/components/operations/operational-profile-provider"
import { BESPOKE_LOGO_SRC } from "@/lib/branding/logo"
import type { NavItem } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

type AppSidebarProps = {
  collapsed: boolean
  mobileOpen: boolean
  onToggleCollapse: () => void
  onCloseMobile: () => void
}

function isNavItemActive(pathname: string, item: NavItem): boolean {
  return item.href === "/"
    ? pathname === "/"
    : pathname.startsWith(item.href)
}

function NavLink({
  item,
  pathname,
  collapsed,
  onCloseMobile,
}: {
  item: NavItem
  pathname: string
  collapsed: boolean
  onCloseMobile: () => void
}) {
  const isActive = isNavItemActive(pathname, item)
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      onClick={onCloseMobile}
      title={collapsed ? item.title : undefined}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          isActive
            ? "text-primary"
            : "text-muted-foreground group-hover:text-sidebar-foreground"
        )}
      />
      {!collapsed && <span className="truncate">{item.title}</span>}
    </Link>
  )
}

function SidebarBrand({
  collapsed,
  homePath,
  onCloseMobile,
}: {
  collapsed: boolean
  homePath: string
  onCloseMobile: () => void
}) {
  return (
    <Link
      href={homePath}
      className="flex items-center justify-center rounded-lg transition-opacity hover:opacity-90"
      onClick={onCloseMobile}
    >
      <img
        src={BESPOKE_LOGO_SRC}
        alt="Bespoke Operations"
        className={cn(
          "shrink-0 object-contain object-center",
          collapsed ? "h-10 w-auto" : "h-12 w-auto"
        )}
      />
    </Link>
  )
}

export function AppSidebar({
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
}: AppSidebarProps) {
  const pathname = usePathname()
  const { navGroups, profile, profileLabel, homePath } = useOperationalProfile()

  const sidebarContent = (
    <>
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center border-b border-sidebar-border px-3",
          collapsed ? "h-[4.75rem] py-2" : "py-4"
        )}
      >
        <SidebarBrand
          collapsed={collapsed}
          homePath={homePath}
          onCloseMobile={onCloseMobile}
        />

        {!collapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-2 hidden -translate-y-1/2 shrink-0 text-muted-foreground lg:inline-flex"
            onClick={onToggleCollapse}
            aria-label="Contraer menú"
          >
            <ChevronLeft className="size-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-2 -translate-y-1/2 shrink-0 text-muted-foreground lg:hidden"
          onClick={onCloseMobile}
          aria-label="Cerrar menú"
        >
          <X className="size-4" />
        </Button>
      </div>

      {!collapsed && (
        <div className="border-b border-sidebar-border px-3 py-2.5">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Perfil operativo
          </p>
          <p className="mt-0.5 truncate text-xs font-medium text-foreground">
            {profileLabel}
          </p>
        </div>
      )}

      <ScrollArea className="flex-1 px-2 py-4">
        <nav className="flex flex-col gap-1">
          {navGroups.map((group) => (
            <div key={group.id} className="flex flex-col gap-0.5">
              {group.label && !collapsed ? (
                <div className="px-2.5 pt-3 pb-1 first:pt-1">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {group.label}
                  </p>
                </div>
              ) : group.label && collapsed ? (
                <div className="my-2 border-t border-sidebar-border/70" />
              ) : null}

              {group.items.map((item) => (
                <NavLink
                  key={`${group.id}-${item.href}-${item.title}`}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                  onCloseMobile={onCloseMobile}
                />
              ))}
            </div>
          ))}
        </nav>
      </ScrollArea>

      {profile === "ventas" && (
        <div className="shrink-0 border-t border-sidebar-border p-3">
          <Button
            asChild
            className={cn(
              "w-full gap-2 font-semibold",
              collapsed && "size-9 px-0"
            )}
            size={collapsed ? "icon-sm" : "default"}
          >
            <Link href="/tareas" onClick={onCloseMobile} title="Nueva Instalación">
              <Plus className="size-4 shrink-0" />
              {!collapsed && <span>Nueva Instalación</span>}
            </Link>
          </Button>
        </div>
      )}

      {collapsed && (
        <div className="hidden shrink-0 border-t border-sidebar-border p-2 lg:block">
          <Button
            variant="ghost"
            size="icon-sm"
            className="mx-auto text-muted-foreground"
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
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "lg:w-[68px]" : "lg:w-64"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
