"use client"

import { Menu } from "lucide-react"

import { UserAccountMenu } from "@/components/auth/user-account-menu"
import { Button } from "@/components/ui/button"

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

      {/*
        UX Cleanup 1.0 — oculto hasta implementación completa:
        import { AppHeaderGlobalSearch } from "@/components/layout/app-header-global-search"
        import { AppHeaderNotifications } from "@/components/layout/app-header-notifications"
        <AppHeaderGlobalSearch />
        <Separator orientation="vertical" className="hidden h-6 md:block" />
        <AppHeaderNotifications />
      */}

      <UserAccountMenu />
    </header>
  )
}
