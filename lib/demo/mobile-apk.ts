/**
 * Bespoke Mobile demo APK — hosted in Supabase Storage, never in Git.
 * The public /demo page only links to DEMO_MOBILE_APK_ROUTE.
 */

export const DEMO_MOBILE_APK_ROUTE = "/api/demo/apk"

export const DEMO_MOBILE_APK_CONTENT_TYPE =
  "application/vnd.android.package-archive"

export const DEMO_DOWNLOADS_BUCKET = "demo-downloads"

export const DEMO_MOBILE_APK_OBJECT_PATH = "bespoke-mobile.apk"

export const DEMO_MOBILE_APK_FILE_NAME = "bespoke-mobile.apk"

/** Inspected from the Release APK (AndroidManifest + file hash). Not the binary. */
export const DEMO_MOBILE_APK_METADATA = {
  applicationId: "com.gen22.bespokefieldagent",
  versionName: "1.0.1",
  versionCode: 2,
  sizeBytes: 55_323_599,
  sha256: "e1ef1deafcd47600988ce379fafbbff5461efb1cf056834bdcfbf72463241c37",
  platform: "Android",
} as const

export function formatDemoApkApproximateSizeMb(
  bytes: number = DEMO_MOBILE_APK_METADATA.sizeBytes
): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

export function getDemoDownloadsBucket(): string {
  return process.env.DEMO_DOWNLOADS_BUCKET?.trim() || DEMO_DOWNLOADS_BUCKET
}

export function getDemoMobileApkObjectPath(): string {
  return (
    process.env.DEMO_MOBILE_APK_OBJECT_PATH?.trim() ||
    DEMO_MOBILE_APK_OBJECT_PATH
  )
}

export function isAllowedDemoApkRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:") {
      return false
    }
    const host = parsed.hostname.toLowerCase()
    if (host === "bespoke-app.online" || host.endsWith(".bespoke-app.online")) {
      return true
    }
    if (host.endsWith(".supabase.co") && parsed.pathname.includes("/storage/")) {
      return true
    }
    return false
  } catch {
    return false
  }
}
