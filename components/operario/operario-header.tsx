"use client"

import { SignOutButton } from "@/components/auth/sign-out-button"
import { BESPOKE_LOGO_SRC } from "@/lib/branding/logo"

export function OperarioHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-white px-4 py-4 sm:py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <img
            src={BESPOKE_LOGO_SRC}
            alt="Bespoke Operations"
            className="h-14 w-auto object-contain"
          />
          <p className="mt-2 text-xs font-medium text-muted-foreground sm:text-[13px]">
            Portal Operario
          </p>
        </div>
        <SignOutButton className="mt-0.5 shrink-0 text-muted-foreground" />
      </div>
    </header>
  )
}
