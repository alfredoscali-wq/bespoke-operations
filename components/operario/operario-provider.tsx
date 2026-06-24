"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import { useAuth } from "@/components/auth/auth-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import {
  mockNotifications,
  type OperarioNotification,
  type WorkerCrewRef,
} from "@/lib/data/operario"
import {
  createLoadingCrewResolution,
  resolveOperarioWorkerCrew,
  type OperarioCrewStatus,
} from "@/lib/operario/crew"
import {
  resolveOperarioIdentity,
  type OperarioIdentity,
} from "@/lib/operario/identity"

type OperarioContextValue = {
  identity: OperarioIdentity
  isIdentityReady: boolean
  workerCrewRef: WorkerCrewRef
  crewStatus: OperarioCrewStatus
  assignedCrewNames: string[]
  isCrewReady: boolean
  notifications: OperarioNotification[]
  unreadCount: number
  markAsRead: (id: string) => void
  markAllAsRead: () => void
}

const OperarioContext = createContext<OperarioContextValue | null>(null)

export function OperarioProvider({ children }: { children: React.ReactNode }) {
  const { sessionUser, isAuthReady } = useAuth()
  const { crews, isCrewsReady } = useCrews()
  const [notifications, setNotifications] =
    useState<OperarioNotification[]>(mockNotifications)

  const identity = useMemo(
    () => resolveOperarioIdentity(sessionUser),
    [sessionUser]
  )

  const isCrewReady = isAuthReady && isCrewsReady

  const crewResolution = useMemo(() => {
    if (!isCrewReady) {
      return createLoadingCrewResolution()
    }

    return resolveOperarioWorkerCrew(sessionUser?.employeeId, crews)
  }, [isCrewReady, sessionUser?.employeeId, crews])

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
      workerCrewRef: crewResolution.workerCrewRef,
      crewStatus: crewResolution.crewStatus,
      assignedCrewNames: crewResolution.assignedCrewNames,
      isCrewReady,
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
    }),
    [
      identity,
      isAuthReady,
      crewResolution,
      isCrewReady,
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
