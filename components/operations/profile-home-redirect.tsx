"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

import { useAuth } from "@/components/auth/auth-provider"
import { useOperationalProfile } from "@/components/operations/operational-profile-provider"
import { getProfileHomePath } from "@/lib/operations/operational-profile"

/** Redirige "/" a la pantalla de inicio según el rol del usuario autenticado. */
export function ProfileHomeRedirect() {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthReady } = useAuth()
  const { profile } = useOperationalProfile()

  useEffect(() => {
    if (!isAuthReady) return
    if (pathname !== "/") return

    const homePath = getProfileHomePath(profile)
    if (homePath !== "/") {
      router.replace(homePath)
    }
  }, [pathname, profile, isAuthReady, router])

  return null
}
