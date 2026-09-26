import { NextResponse } from "next/server"

import { resolveDemoMobileApkDownloadUrl } from "@/lib/demo/demo-apk-storage"
import { isAllowedDemoApkRedirectUrl } from "@/lib/demo/mobile-apk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const configuredUrl = process.env.BESPOKE_MOBILE_APK_URL?.trim()
  if (configuredUrl && isAllowedDemoApkRedirectUrl(configuredUrl)) {
    return NextResponse.redirect(configuredUrl, 302)
  }

  const downloadUrl = await resolveDemoMobileApkDownloadUrl()
  if (!downloadUrl) {
    return NextResponse.json(
      {
        success: false,
        message:
          "La APK de Bespoke Mobile todavía no está publicada en este entorno.",
      },
      { status: 404 }
    )
  }

  return NextResponse.redirect(downloadUrl, 302)
}
