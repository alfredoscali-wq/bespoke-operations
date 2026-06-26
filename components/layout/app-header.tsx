"use client"

import { Bell, Menu, Search } from "lucide-react"

import { UserAccountMenu } from "@/components/auth/user-account-menu"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

type AppHeaderProps = {
  title: string
  subtitle?: string
  onOpenMobileMenu: () => void
}

export function AppHeader({
  title,
  subtitle,
  onOpenMobileMenu,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-5 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-8">
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground lg:hidden"
        onClick={onOpenMobileMenu}
        aria-label="Abrir menú"
      >
        <Menu className="size-4" />
      </Button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
          {title}
        </h1>
        {subtitle && (
          <p className="hidden truncate text-sm text-muted-foreground sm:block">
            {subtitle}
          </p>
        )}
      </div>

      <div className="hidden w-full max-w-sm md:block">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar obras, órdenes de trabajo, cuadrillas..."
            className="h-8 bg-muted/40 pl-8"
          />
        </div>
      </div>

      <Separator orientation="vertical" className="hidden h-6 md:block" />

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative text-muted-foreground"
          aria-label="Notificaciones"
        >
          <Bell className="size-4" />
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden text-muted-foreground"
          aria-label="Buscar"
        >
          <Search className="size-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />

        <UserAccountMenu />
      </div>
    </header>
  )
}
