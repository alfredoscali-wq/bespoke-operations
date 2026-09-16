import "server-only"

import type { CSSProperties } from "react"

import { getSessionUser } from "@/lib/auth/session"
import { tenantChromeStyle } from "@/lib/company-branding/theme"
import type { CompanyBranding } from "@/lib/company-branding/types"
import { resolveAuthenticatedLogoSrc } from "@/lib/company-branding/validate"
import { createClient } from "@/lib/supabase/server"
import { fetchCompanyBranding } from "@/lib/supabase/company-branding.queries"

export type AuthenticatedChromeBranding = {
  logoSrc: string
  logoAlt: string
  style?: CSSProperties
  branding: CompanyBranding | null
}

export async function loadAuthenticatedChromeBranding(input: {
  instanceLogoSrc: string
  instanceLogoAlt: string
}): Promise<AuthenticatedChromeBranding> {
  try {
    const sessionUser = await getSessionUser()
    const companyId = sessionUser?.companyId?.trim()
    if (!companyId) {
      return {
        logoSrc: input.instanceLogoSrc,
        logoAlt: input.instanceLogoAlt,
        branding: null,
      }
    }

    const client = await createClient()
    const branding = await fetchCompanyBranding(client, companyId)
    return {
      logoSrc: resolveAuthenticatedLogoSrc(
        branding?.logoUrl,
        input.instanceLogoSrc
      ),
      logoAlt: input.instanceLogoAlt,
      style: tenantChromeStyle({
        primaryColor: branding?.primaryColor,
        secondaryColor: branding?.secondaryColor,
      }),
      branding,
    }
  } catch {
    return {
      logoSrc: input.instanceLogoSrc,
      logoAlt: input.instanceLogoAlt,
      branding: null,
    }
  }
}
