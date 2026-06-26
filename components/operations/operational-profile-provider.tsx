"use client"

import {
  createContext,
  useContext,
  useMemo,
} from "react"

import { useAuth } from "@/components/auth/auth-provider"
import { buildNavGroupsForProfile } from "@/lib/navigation/profile-navigation"
import type { NavGroup } from "@/lib/navigation"
import {
  getProfileHomePath,
  mapSystemRoleToOperationalProfile,
  OPERATIONAL_PROFILE_LABELS,
  type OperationalProfile,
} from "@/lib/operations/operational-profile"

type OperationalProfileContextValue = {
  profile: OperationalProfile
  profileLabel: string
  homePath: string
  navGroups: NavGroup[]
}

const OperationalProfileContext =
  createContext<OperationalProfileContextValue | null>(null)

export function OperationalProfileProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { sessionUser } = useAuth()

  const profile = useMemo(
    () => mapSystemRoleToOperationalProfile(sessionUser?.systemRole),
    [sessionUser?.systemRole]
  )

  const navGroups = useMemo(
    () => buildNavGroupsForProfile(profile),
    [profile]
  )

  const homePath = useMemo(() => getProfileHomePath(profile), [profile])

  const value = useMemo(
    () => ({
      profile,
      profileLabel: OPERATIONAL_PROFILE_LABELS[profile],
      homePath,
      navGroups,
    }),
    [profile, homePath, navGroups]
  )

  return (
    <OperationalProfileContext.Provider value={value}>
      {children}
    </OperationalProfileContext.Provider>
  )
}

export function useOperationalProfile() {
  const context = useContext(OperationalProfileContext)

  if (!context) {
    throw new Error(
      "useOperationalProfile must be used within OperationalProfileProvider"
    )
  }

  return context
}
