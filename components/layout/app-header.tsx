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
    <header className="sticky top-0 z-30 flex min-h-16 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/95 px-4 py-2 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)] backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:gap-4 sm:px-6">
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-slate-400 hover:text-slate-600 lg:hidden"
        onClick={onOpenMobileMenu}
        aria-label="Abrir menú"
      >
        <Menu className="size-4" />
      </Button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold tracking-tight text-slate-800 sm:text-lg">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-0.5 hidden truncate text-sm text-slate-500 lg:block">
            {subtitle}
          </p>
        ) : null}
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
