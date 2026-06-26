"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"

import { buildAuthEmail } from "@/lib/auth/auth-identity"
import {
  getDefaultPostLoginPath,
  sanitizeRedirectPath,
} from "@/lib/auth/routes"
import { buildSessionUserFromAuthUser } from "@/lib/auth/resolve-session-user"
import type { SessionUser } from "@/lib/auth/types"
import { recordUserSessionAudit } from "@/lib/audit/users-audit"
import { getEmployeeByAppUserId } from "@/lib/supabase/employees.browser"
import { createClient } from "@/lib/supabase/client"

type AuthContextValue = {
  sessionUser: SessionUser | null
  isAuthReady: boolean
  isAuthenticated: boolean
  signIn: (dni: string, password: string) => Promise<SessionUser>
  signOut: () => Promise<void>
  refreshSession: () => Promise<SessionUser | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function resolveSessionUserFromAuthUser(
  user: User
): Promise<SessionUser> {
  const employeeResult = await getEmployeeByAppUserId(user.id)
  const employee = employeeResult.data ?? null
  return buildSessionUserFromAuthUser(user, employee)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [isAuthReady, setIsAuthReady] = useState(false)

  const refreshSession = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      setSessionUser(null)
      return null
    }

    const resolved = await resolveSessionUserFromAuthUser(user)
    setSessionUser(resolved)
    return resolved
  }, [])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function initializeAuth() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (cancelled) return

        if (user) {
          const resolved = await resolveSessionUserFromAuthUser(user)
          if (!cancelled) {
            setSessionUser(resolved)
          }
        } else {
          setSessionUser(null)
        }
      } finally {
        if (!cancelled) {
          setIsAuthReady(true)
        }
      }
    }

    void initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        if (!session?.user) {
          setSessionUser(null)
          return
        }

        const resolved = await resolveSessionUserFromAuthUser(session.user)
        setSessionUser(resolved)
      })()
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(
    async (dni: string, password: string) => {
      const supabase = createClient()
      const email = buildAuthEmail(dni)

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      if (!data.user) {
        throw new Error("No se pudo iniciar sesión.")
      }

      const resolved = await resolveSessionUserFromAuthUser(data.user)
      setSessionUser(resolved)
      void recordUserSessionAudit("USER_LOGIN")
      return resolved
    },
    []
  )

  const signOut = useCallback(async () => {
    await recordUserSessionAudit("USER_LOGOUT")
    const supabase = createClient()
    await supabase.auth.signOut()
    setSessionUser(null)
    router.push("/login")
    router.refresh()
  }, [router])

  const value = useMemo(
    () => ({
      sessionUser,
      isAuthReady,
      isAuthenticated: sessionUser !== null,
      signIn,
      signOut,
      refreshSession,
    }),
    [sessionUser, isAuthReady, signIn, signOut, refreshSession]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }

  return context
}

export function useAuthOptional() {
  return useContext(AuthContext)
}

export function redirectAfterSignIn(
  router: ReturnType<typeof useRouter>,
  sessionUser: SessionUser,
  nextPath?: string | null
) {
  const destination = sanitizeRedirectPath(
    nextPath,
    getDefaultPostLoginPath(sessionUser.systemRole)
  )

  router.push(destination)
  router.refresh()
}
