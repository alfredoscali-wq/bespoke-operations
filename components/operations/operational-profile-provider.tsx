"use client"

import {
  createContext,
  useContext,
  useMemo,
} from "react"

import { useAuth } from "@/components/auth/auth-provider"
import type { SessionUser } from "@/lib/auth/types"
import {
  buildNavGroupsFromModuleVisibility,
  getAllNavItemsFromModuleVisibility,
  resolveHomePathFromModuleVisibility,
} from "@/lib/navigation/build-nav-from-modules"
import {
  buildNavGroupsForProfile,
  getPageMetaForProfile,
} from "@/lib/navigation/profile-navigation"
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
  usesRoleModules: boolean
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

  const usesRoleModules = Boolean(sessionUser?.roleId)

  const navGroups = useMemo(() => {
    if (sessionUser?.roleId) {
      return buildNavGroupsFromModuleVisibility(sessionUser.moduleVisibility)
    }

    return buildNavGroupsForProfile(profile)
  }, [profile, sessionUser?.moduleVisibility, sessionUser?.roleId])

  const homePath = useMemo(() => {
    if (sessionUser?.roleId) {
      return resolveHomePathFromModuleVisibility(sessionUser.moduleVisibility)
    }

    return getProfileHomePath(profile)
  }, [profile, sessionUser?.moduleVisibility, sessionUser?.roleId])

  const profileLabel = sessionUser?.roleName ?? OPERATIONAL_PROFILE_LABELS[profile]

  const value = useMemo(
    () => ({
      profile,
      profileLabel,
      homePath,
      navGroups,
      usesRoleModules,
    }),
    [profile, profileLabel, homePath, navGroups, usesRoleModules]
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

export function getPageMetaForSession(
  pathname: string,
  profile: OperationalProfile,
  sessionUser: SessionUser | null
): { title: string; subtitle: string } {
  if (sessionUser?.roleId) {
    const navItems = getAllNavItemsFromModuleVisibility(
      sessionUser.moduleVisibility
    )
    const match =
      [...navItems]
        .filter((item) =>
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href)
        )
        .sort((a, b) => b.href.length - a.href.length)[0] ?? navItems[0]

    if (match) {
      return {
        title: match.pageTitle ?? match.title,
        subtitle: match.description ?? "Gestión operativa de infraestructura",
      }
    }
  }

  return getPageMetaForProfile(pathname, profile)
}
