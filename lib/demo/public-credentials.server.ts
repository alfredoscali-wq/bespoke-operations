import "server-only"

import {
  BESPOKE_DEMO_COMPANY_NAME,
  DEMO_COMMERCIAL_USERNAME,
  DEMO_MOBILE_COMPANY_CODE_DISPLAY,
} from "@/lib/demo/constants"

function readEnvPassword(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) {
      return value
    }
  }
  return ""
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
 * Passwords for the public /demo page. Never import hardcoded secrets here.
 * Set DEMO_WEB_PASSWORD and DEMO_MOBILE_PASSWORD in the environment.
 */
export function getDemoPublicCredentials(): DemoPublicCredentials {
  return {
    companyName: BESPOKE_DEMO_COMPANY_NAME,
    companyCode: DEMO_MOBILE_COMPANY_CODE_DISPLAY,
    webUsername: DEMO_COMMERCIAL_USERNAME,
    webPassword: readEnvPassword("DEMO_WEB_PASSWORD", "DEMO_ADMIN_PASSWORD"),
    mobileUsername: DEMO_COMMERCIAL_USERNAME,
    mobilePassword: readEnvPassword(
      "DEMO_MOBILE_PASSWORD",
      "DEMO_OPERARIO_PASSWORD"
    ),
  }
}
