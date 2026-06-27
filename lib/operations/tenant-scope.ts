import type { SessionUser } from "@/lib/auth/types"
import {
  BESPOKE_DEMO_COMPANY_ID,
  BESPOKE_PRODUCTION_COMPANY_ID,
} from "@/lib/supabase/company.constants"

/**
 * Resolves the active tenant from the authenticated session.
 * Falls back to the production company — never to the demo tenant.
 */
export function resolveTenantCompanyId(
  sessionUser: Pick<SessionUser, "companyId"> | null | undefined
): string {
  return sessionUser?.companyId ?? BESPOKE_PRODUCTION_COMPANY_ID
}

export function isDemoTenantCompanyId(companyId: string): boolean {
  return companyId === BESPOKE_DEMO_COMPANY_ID
}

export function isProductionTenantCompanyId(companyId: string): boolean {
  return companyId === BESPOKE_PRODUCTION_COMPANY_ID
}
