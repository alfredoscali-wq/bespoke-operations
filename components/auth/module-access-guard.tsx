"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

import { useAuth } from "@/components/auth/auth-provider"
import { useOperationalProfile } from "@/components/operations/operational-profile-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { canAccessPathWithModules } from "@/lib/roles/app-modules"

export function ModuleAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { sessionUser, isAuthReady } = useAuth()
  const { homePath, usesRoleModules } = useOperationalProfile()

  const isAllowed =
    !usesRoleModules ||
    !sessionUser?.roleId ||
    canAccessPathWithModules(pathname, sessionUser.moduleVisibility)

  useEffect(() => {
    if (!isAuthReady || isAllowed) {
      return
    }

    router.replace(homePath)
  }, [homePath, isAllowed, isAuthReady, router])

  if (!isAuthReady) {
    return children
  }

  if (!isAllowed) {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Acceso restringido</CardTitle>
          <CardDescription>
            Su rol no tiene permiso para acceder a este módulo.
          </CardDescription>
          <Button asChild variant="outline" className="mt-4 w-fit">
            <Link href={homePath}>Volver al inicio</Link>
          </Button>
        </CardHeader>
      </Card>
    )
  }

  return children
}
