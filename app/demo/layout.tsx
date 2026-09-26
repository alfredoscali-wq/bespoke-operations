import Image from "next/image"
import type { ReactNode } from "react"

import { PWA_SHORT_NAME } from "@/lib/pwa/config"

export default function DemoLandingLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F4FAFA] text-[#12324D]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_left,rgba(255,110,61,0.16),transparent_42%),radial-gradient(circle_at_top_right,rgba(5,214,179,0.14),transparent_38%)]" />
      <header className="relative border-b border-white/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Image
            src="/images/logo/LOGO_BESPOKE.png"
            alt={PWA_SHORT_NAME}
            width={132}
            height={40}
            className="h-9 w-auto object-contain"
            priority
          />
          <span className="rounded-full bg-[#05D6B3]/15 px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-[#0B7C6A]">
            DEMO · DATOS FICTICIOS
          </span>
        </div>
      </header>
      <main className="relative px-4 py-10 sm:px-6 sm:py-14">{children}</main>
      <footer className="relative border-t border-[#D7E4EC] bg-white/90">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-[#5A7188] sm:px-6">
          <p className="font-medium text-[#12324D]">
            Bespoke · Entorno de demostración
          </p>
          <p className="mt-1">
            Todos los datos utilizados en esta demo son ficticios.
          </p>
        </div>
      </footer>
    </div>
  )
}
