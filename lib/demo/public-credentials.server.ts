import "server-only"

import {
  BESPOKE_DEMO_COMPANY_NAME,
  DEMO_COMMERCIAL_USERNAME,
  DEMO_MOBILE_COMPANY_CODE_DISPLAY,
} from "@/lib/demo/constants"

/** Visible only on the public /demo landing. Auth still uses DEMO_*_PASSWORD. */
const DEMO_PUBLIC_LANDING_PASSWORD = "demo123"

function readEnvPassword(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) {
      return value
    }
  }
  return ""
}

function publicLandingPassword(...keys: string[]): string {
  const configured = readEnvPassword(...keys)
  if (configured === DEMO_PUBLIC_LANDING_PASSWORD) {
    return configured
  }
  return DEMO_PUBLIC_LANDING_PASSWORD
}

export type DemoPublicCredentials = {
  companyName: string
  companyCode: string
  webUsername: string
  webPassword: string
  mobileUsername: string
  mobilePassword: string
}

/**
 * Credentials shown on the public /demo page.
 * Login/Auth continue to use DEMO_WEB_PASSWORD and DEMO_MOBILE_PASSWORD.
 */
export function getDemoPublicCredentials(): DemoPublicCredentials {
  return {
    companyName: BESPOKE_DEMO_COMPANY_NAME,
    companyCode: DEMO_MOBILE_COMPANY_CODE_DISPLAY,
    webUsername: DEMO_COMMERCIAL_USERNAME,
    webPassword: publicLandingPassword(
      "DEMO_WEB_PASSWORD",
      "DEMO_ADMIN_PASSWORD"
    ),
    mobileUsername: DEMO_COMMERCIAL_USERNAME,
    mobilePassword: publicLandingPassword(
      "DEMO_MOBILE_PASSWORD",
      "DEMO_OPERARIO_PASSWORD"
    ),
  }
}
