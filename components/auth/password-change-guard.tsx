"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"

import { useAuth } from "@/components/auth/auth-provider"
import {
  CHANGE_PASSWORD_PATH,
  getDefaultPostLoginPath,
  isPasswordChangeGuardAllowedPath,
} from "@/lib/auth/routes"

export function PasswordChangeGuard() {
  const router = useRouter()
  const pathname = usePathname()
  const { sessionUser, isAuthReady, isAuthenticated } = useAuth()
  const lastRedirectRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isAuthReady || !isAuthenticated || !sessionUser) {
      lastRedirectRef.current = null
      return
    }

    const onChangePasswordPath =
      pathname === CHANGE_PASSWORD_PATH ||
      pathname.startsWith(`${CHANGE_PASSWORD_PATH}/`)

    if (sessionUser.mustChangePassword) {
      if (isPasswordChangeGuardAllowedPath(pathname)) {
        lastRedirectRef.current = null
        return
      }

      if (lastRedirectRef.current === CHANGE_PASSWORD_PATH) {
        return
      }

      lastRedirectRef.current = CHANGE_PASSWORD_PATH
      router.replace(CHANGE_PASSWORD_PATH)
      return
    }

    if (!onChangePasswordPath) {
      lastRedirectRef.current = null
      return
    }

    const destination = getDefaultPostLoginPath(sessionUser.systemRole)

    if (pathname === destination) {
      lastRedirectRef.current = null
      return
    }

    if (lastRedirectRef.current === destination) {
      return
    }

    lastRedirectRef.current = destination
    router.replace(destination)
  }, [
    isAuthReady,
    isAuthenticated,
    pathname,
    router,
    sessionUser,
  ])

  return null
}
