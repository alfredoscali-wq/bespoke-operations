import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  DEMO_MOBILE_APK_FILE_NAME,
  getDemoDownloadsBucket,
  getDemoMobileApkObjectPath,
  isAllowedDemoApkRedirectUrl,
} from "@/lib/demo/mobile-apk"

const SIGNED_URL_TTL_SECONDS = 60 * 60

function objectFileName(objectPath: string): string {
  const parts = objectPath.split("/").filter(Boolean)
  return parts[parts.length - 1] || DEMO_MOBILE_APK_FILE_NAME
}

function objectFolder(objectPath: string): string {
  const parts = objectPath.split("/").filter(Boolean)
  return parts.length > 1 ? parts.slice(0, -1).join("/") : ""
}

export async function apkObjectExistsInStorage(): Promise<boolean> {
  const admin = createAdminClient()
  const bucket = getDemoDownloadsBucket()
  const objectPath = getDemoMobileApkObjectPath()
  const fileName = objectFileName(objectPath)

  const { data, error } = await admin.storage
    .from(bucket)
    .list(objectFolder(objectPath), {
      search: fileName,
      limit: 50,
    })

  if (error || !data) {
    return false
  }

  return data.some((item) => item.name === fileName && item.id)
}

export async function resolveDemoMobileApkDownloadUrl(): Promise<string | null> {
  const exists = await apkObjectExistsInStorage()
  if (!exists) {
    return null
  }

  const admin = createAdminClient()
  const bucket = getDemoDownloadsBucket()
  const objectPath = getDemoMobileApkObjectPath()

  const { data: publicData } = admin.storage
    .from(bucket)
    .getPublicUrl(objectPath, { download: DEMO_MOBILE_APK_FILE_NAME })

  const publicUrl = publicData?.publicUrl?.trim()
  if (publicUrl && isAllowedDemoApkRedirectUrl(publicUrl)) {
    const reachable = await isPublicStorageObjectReachable(publicUrl)
    if (reachable) {
      return publicUrl
    }
  }

  const { data: signed, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS, {
      download: DEMO_MOBILE_APK_FILE_NAME,
    })

  const signedUrl = signed?.signedUrl?.trim()
  if (error || !signedUrl || !isAllowedDemoApkRedirectUrl(signedUrl)) {
    return null
  }

  return signedUrl
}

async function isPublicStorageObjectReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    })
    if (response.ok) {
      return true
    }
    if (response.status === 405) {
      const ranged = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        redirect: "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      })
      return ranged.ok || ranged.status === 206
    }
    return false
  } catch {
    return false
  }
}
