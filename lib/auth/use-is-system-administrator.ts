"use client"

import { useAuth } from "@/components/auth/auth-provider"

export function useIsSystemAdministrator(): boolean {
  const { sessionUser } = useAuth()
  return sessionUser?.systemRole === "administrador"
}
