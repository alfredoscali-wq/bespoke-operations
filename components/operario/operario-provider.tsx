"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import {
  FIELD_WORKER,
  mockNotifications,
  type OperarioNotification,
} from "@/lib/data/operario"

type OperarioContextValue = {
  worker: typeof FIELD_WORKER
  notifications: OperarioNotification[]
  unreadCount: number
  markAsRead: (id: string) => void
  markAllAsRead: () => void
}

const OperarioContext = createContext<OperarioContextValue | null>(null)

export function OperarioProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] =
    useState<OperarioNotification[]>(mockNotifications)

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
      worker: FIELD_WORKER,
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
    }),
    [notifications, unreadCount, markAsRead, markAllAsRead]
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
