"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  Radio,
  X,
} from "lucide-react"

import { navGroups, type NavItem } from "@/lib/navigation"
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

export function AppSidebar({
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
}: AppSidebarProps) {
  const pathname = usePathname()

  const sidebarContent = (
    <>
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-sidebar-border px-3",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2.5 overflow-hidden rounded-lg px-2 py-1.5 transition-colors hover:bg-sidebar-accent",
            collapsed && "px-0"
          )}
          onClick={onCloseMobile}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Radio className="size-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
                Bespoke Operations
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Infraestructura &amp; Telecom
              </p>
            </div>
          )}
        </Link>

        {!collapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden text-muted-foreground lg:inline-flex"
            onClick={onToggleCollapse}
            aria-label="Contraer menú"
          >
            <ChevronLeft className="size-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground lg:hidden"
          onClick={onCloseMobile}
          aria-label="Cerrar menú"
        >
          <X className="size-4" />
        </Button>
      </div>

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
                  key={item.href}
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

      {!collapsed && (
        <div className="shrink-0 border-t border-sidebar-border p-3">
          <div className="rounded-lg bg-muted/60 px-3 py-3">
            <p className="text-xs font-medium text-foreground">
              Operaciones de campo
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Fibra · Cámaras · Wireless · Postes
            </p>
          </div>
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
