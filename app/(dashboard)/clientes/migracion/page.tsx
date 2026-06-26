"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { ClientesSectionNav } from "@/components/clientes/clientes-section-nav"
import { MigrationReviewModule } from "@/components/clientes/migration/migration-review-module"
import { useOperationalProfile } from "@/components/operations/operational-profile-provider"

export default function ClientesMigracionPage() {
  const router = useRouter()
  const { profile, isProfileReady } = useOperationalProfile()

  useEffect(() => {
    if (!isProfileReady) return
    if (profile !== "administrador") {
      router.replace("/clientes")
    }
  }, [profile, isProfileReady, router])

  if (!isProfileReady || profile !== "administrador") {
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
