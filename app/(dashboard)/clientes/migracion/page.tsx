"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { ClientesSectionNav } from "@/components/clientes/clientes-section-nav"
import { MigrationReviewModule } from "@/components/clientes/migration/migration-review-module"
import { useAuth } from "@/components/auth/auth-provider"
import { useIsSystemAdministrator } from "@/lib/auth/use-is-system-administrator"

export default function ClientesMigracionPage() {
  const router = useRouter()
  const { isAuthReady } = useAuth()
  const isAdministrator = useIsSystemAdministrator()

  useEffect(() => {
    if (!isAuthReady) return
    if (!isAdministrator) {
      router.replace("/clientes")
    }
  }, [isAdministrator, isAuthReady, router])

  if (!isAuthReady || !isAdministrator) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
        Verificando acceso...
      </div>
    )
  }

  return (
    <>
      <MigrationReviewModule />
    </>
  )
}
