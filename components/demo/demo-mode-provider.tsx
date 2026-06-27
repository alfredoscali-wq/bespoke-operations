"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { DemoRestrictedDialog } from "@/components/demo/demo-restricted-dialog"
import { useAuth } from "@/components/auth/auth-provider"
import {
  isDemoPlatformReadOnlyUser,
  shouldShowDemoBanner,
} from "@/lib/demo/demo-mode"

type DemoModeContextValue = {
  isReadOnly: boolean
  showBanner: boolean
  openRestrictedDialog: () => void
}

const DemoModeContext = createContext<DemoModeContextValue | null>(null)

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const { sessionUser } = useAuth()
  const [restrictedOpen, setRestrictedOpen] = useState(false)

  const isReadOnly = isDemoPlatformReadOnlyUser(sessionUser)
  const showBanner = shouldShowDemoBanner(sessionUser)

  const openRestrictedDialog = useCallback(() => {
    setRestrictedOpen(true)
  }, [])

  const value = useMemo(
    () => ({
      isReadOnly,
      showBanner,
      openRestrictedDialog,
    }),
    [isReadOnly, showBanner, openRestrictedDialog]
  )

  return (
    <DemoModeContext.Provider value={value}>
      {children}
      <DemoRestrictedDialog
        open={restrictedOpen}
        onOpenChange={setRestrictedOpen}
      />
    </DemoModeContext.Provider>
  )
}

export function useDemoMode() {
  const context = useContext(DemoModeContext)

  if (!context) {
    return {
      isReadOnly: false,
      showBanner: false,
      openRestrictedDialog: () => {},
    }
  }

  return context
}

export function useDemoWriteGuard() {
  const { isReadOnly, openRestrictedDialog } = useDemoMode()

  const guardWrite = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T | null> => {
      if (isReadOnly) {
        openRestrictedDialog()
        return null
      }

      return operation()
    },
    [isReadOnly, openRestrictedDialog]
  )

  const guardWriteSync = useCallback(
    (operation: () => void): boolean => {
      if (isReadOnly) {
        openRestrictedDialog()
        return false
      }

      operation()
      return true
    },
    [isReadOnly, openRestrictedDialog]
  )

  return {
    isReadOnly,
    guardWrite,
    guardWriteSync,
    openRestrictedDialog,
  }
}
