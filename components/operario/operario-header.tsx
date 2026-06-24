"use client"

import { Radio } from "lucide-react"

import { SignOutButton } from "@/components/auth/sign-out-button"

export function OperarioHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Radio className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-foreground">
              Bespoke Campo
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Portal de operario
            </p>
          </div>
        </div>
        <SignOutButton className="text-muted-foreground" />
      </div>
    </header>
  )
}
