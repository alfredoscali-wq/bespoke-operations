import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"

import { PWA_SHORT_NAME } from "@/lib/pwa/config"

export default function DemoLandingLayout({
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
            <p className="text-sm font-semibold">BESPOKE DEMO</p>
            <p className="text-xs text-muted-foreground">Probar Bespoke Operations</p>
          </div>
        </div>
      </header>
      <main className="px-4 py-10">{children}</main>
      <footer className="border-t bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 text-xs text-muted-foreground">
          Entorno ficticio de demostración.{" "}
          <Link href="/login" className="text-primary hover:underline">
            Iniciar sesión
          </Link>
        </div>
      </footer>
    </div>
  )
}
