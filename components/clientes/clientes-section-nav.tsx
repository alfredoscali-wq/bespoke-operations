"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { useOperationalProfile } from "@/components/operations/operational-profile-provider"
import { cn } from "@/lib/utils"

export function ClientesSectionNav() {
  const pathname = usePathname()
  const { profile } = useOperationalProfile()

  if (profile !== "administrador") {
    return null
  }

  const items = [
    { href: "/clientes", label: "Directorio" },
    { href: "/clientes/migracion", label: "Migración de Clientes" },
  ]

  return (
    <div className="mb-6 flex flex-wrap gap-2 border-b pb-4">
      {items.map((item) => {
        const isActive =
          item.href === "/clientes"
            ? pathname === "/clientes"
            : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
