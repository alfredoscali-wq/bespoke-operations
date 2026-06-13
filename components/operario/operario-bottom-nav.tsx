"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bell,
  ClipboardList,
  Home,
  User,
} from "lucide-react"

import { useOperario } from "@/components/operario/operario-provider"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/operario", label: "Inicio", icon: Home, exact: true },
  { href: "/operario/tareas", label: "Tareas", icon: ClipboardList },
  {
    href: "/operario/notificaciones",
    label: "Notificaciones",
    icon: Bell,
    badge: true,
  },
  { href: "/operario/perfil", label: "Perfil", icon: User },
]

function isNavItemActive(pathname: string, href: string, exact?: boolean) {
  if (exact) {
    return pathname === href
  }

  if (href === "/operario/tareas") {
    return (
      pathname.startsWith("/operario/tareas") ||
      pathname.startsWith("/operario/tarea/")
    )
  }

  return pathname.startsWith(href)
}

export function OperarioBottomNav() {
  const pathname = usePathname()
  const { unreadCount } = useOperario()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {navItems.map((item) => {
          const isActive = isNavItemActive(pathname, item.href, item.exact)
          const Icon = item.icon
          const showBadge = item.badge && unreadCount > 0

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-w-[64px] flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:bg-muted/60"
              )}
            >
              <span className="relative">
                <Icon className={cn("size-5", isActive && "stroke-[2.5]")} />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
