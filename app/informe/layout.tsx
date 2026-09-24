import Image from "next/image"
import type { ReactNode } from "react"

import { PWA_SHORT_NAME } from "@/lib/pwa/config"

import "@/components/obras/project-work-report-print.css"

export default function PublicInformeLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Image
            src="/images/logo/LOGO_BESPOKE.png"
            alt={PWA_SHORT_NAME}
            width={120}
            height={36}
            className="h-8 w-auto object-contain"
          />
          <div className="leading-tight">
            <p className="text-sm font-semibold">{PWA_SHORT_NAME}</p>
            <p className="text-xs text-muted-foreground">Informe de obra</p>
          </div>
        </div>
      </header>
      <main className="px-4 py-8">{children}</main>
    </div>
  )
}
