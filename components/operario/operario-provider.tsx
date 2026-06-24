"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import { useAuth } from "@/components/auth/auth-provider"
import {
  mockNotifications,
  TEMP_OPERARIO_CREW_NAME,
  type OperarioNotification,
} from "@/lib/data/operario"
import {
  resolveOperarioIdentity,
  type OperarioIdentity,
} from "@/lib/operario/identity"

type OperarioContextValue = {
  identity: OperarioIdentity
  isIdentityReady: boolean
  /** Temporary until Fase 2 resolves crew from crew_members. */
  crewName: string
  notifications: OperarioNotification[]
  unreadCount: number
  markAsRead: (id: string) => void
  markAllAsRead: () => void
}

const OperarioContext = createContext<OperarioContextValue | null>(null)

export function OperarioProvider({ children }: { children: React.ReactNode }) {
  const { sessionUser, isAuthReady } = useAuth()
  const [notifications, setNotifications] =
    useState<OperarioNotification[]>(mockNotifications)

  const identity = useMemo(
    () => resolveOperarioIdentity(sessionUser),
    [sessionUser]
  )

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  )

  const markAsRead = useCallback((id: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    )
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, read: true }))
    )
  }, [])

  const value = useMemo(
    () => ({
      identity,
      isIdentityReady: isAuthReady,
      crewName: TEMP_OPERARIO_CREW_NAME,
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
    }),
    [
      identity,
      isAuthReady,
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
    ]
  )

  return (
    <OperarioContext.Provider value={value}>{children}</OperarioContext.Provider>
  )
}

export function useOperario() {
  const context = useContext(OperarioContext)
  if (!context) {
    throw new Error("useOperario must be used within OperarioProvider")
  }
  return context
}
