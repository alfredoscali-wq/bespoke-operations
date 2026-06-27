"use client"

import { useAuth } from "@/components/auth/auth-provider"
import {
  isDemoTenantCompanyId,
  resolveTenantCompanyId,
} from "@/lib/operations/tenant-scope"

export function useTenantCompanyId() {
  const { sessionUser, isAuthReady } = useAuth()
  const companyId = resolveTenantCompanyId(sessionUser)

  return {
    companyId,
    isAuthReady,
    isDemoTenant: isDemoTenantCompanyId(companyId),
  }
}
