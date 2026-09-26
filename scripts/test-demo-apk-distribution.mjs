/**
 * Demo APK distribution — Storage + /demo + /api/demo/apk.
 * Does not mutate ABNet or existing production buckets.
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import { createClient } from "@supabase/supabase-js"

const root = resolve(import.meta.dirname, "..")
const BUCKET = "demo-downloads"
const OBJECT_PATH = "bespoke-mobile.apk"
const APK_CONTENT_TYPE = "application/vnd.android.package-archive"
const LOCAL_APK = "C:/Users/alfre/Downloads/Bespoke-Mobile.apk"
const PROTECTED_BUCKETS = [
  "evidences",
  "task-photos",
  "automatic-reports",
  "task-incident-photos",
  "treasury-receipts",
  "attachments",
  "isp-billing-logos",
  "company-branding-logos",
]

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

function loadEnv() {
  const env = readFileSync(resolve(root, ".env.local"), "utf8")
  const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim()
  const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim()
  if (!url || !key) {
    throw new Error("Missing Supabase env")
  }
  return { url, key, env }
}

const origin =
  process.env.DEMO_VERIFY_ORIGIN?.trim() || "http://localhost:3000"

test("source: APK is not published from public/ or Git", () => {
  const apkRoute = read("app/api/demo/apk/route.ts")
  const gitignore = read(".gitignore")
  assert.doesNotMatch(apkRoute, /join\(process\.cwd\(\), "public"/)
  assert.doesNotMatch(apkRoute, /PUBLIC_DEMO_APK_CANDIDATE_PATHS/)
  assert.doesNotMatch(apkRoute, /readFile\(/)
  assert.match(apkRoute, /resolveDemoMobileApkDownloadUrl/)
  assert.match(gitignore, /\*\.apk/)
  assert.match(gitignore, /public\/downloads/)
  assert.equal(existsSync(resolve(root, "public/downloads/bespoke-mobile.apk")), false)
})

test("source: frontend has no Supabase secrets", () => {
  const landing = read("components/demo/demo-landing-page.tsx")
  const page = read("app/demo/page.tsx")
  const credentials = read("lib/demo/public-credentials.server.ts")
  assert.doesNotMatch(landing, /SUPABASE_SERVICE_ROLE|service_role|eyJ/)
  assert.doesNotMatch(page, /SUPABASE_SERVICE_ROLE|service_role/)
  assert.match(credentials, /DEMO_WEB_PASSWORD/)
  assert.match(credentials, /DEMO_MOBILE_PASSWORD/)
  assert.doesNotMatch(credentials, /Demo2026!/)
  assert.match(landing, /DEMO_MOBILE_APK_DOWNLOAD_PATH/)
  assert.match(landing, /DESCARGAR BESPOKE MOBILE/)
  assert.match(landing, /Android/)
  assert.match(landing, /Versión/)
  assert.match(landing, /Tamaño aproximado/)
})

test("source: only demo-downloads bucket is introduced", () => {
  const migration = read(
    "supabase/migrations/20261229000100_demo_downloads_storage.sql"
  )
  const publish = read("scripts/publish-demo-mobile-apk.mjs")
  assert.match(migration, /demo-downloads/)
  assert.match(migration, /bucket_id = 'demo-downloads'/)
  assert.equal((migration.match(/INSERT INTO storage\.buckets/g) || []).length, 1)
  assert.match(publish, /PROTECTED_BUCKETS/)
  assert.match(publish, /evidences/)
  assert.doesNotMatch(publish, /abnet-7k5g/)
})

test("live: bucket, object, size and SHA-256", async () => {
  const { url, key } = loadEnv()
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: buckets, error } = await supabase.storage.listBuckets()
  assert.equal(error, null)
  const names = new Set((buckets ?? []).map((bucket) => bucket.id))
  assert.equal(names.has(BUCKET), true)
  for (const protectedName of PROTECTED_BUCKETS) {
    assert.equal(names.has(protectedName), true, `kept ${protectedName}`)
  }

  const demo = buckets.find((bucket) => bucket.id === BUCKET)
  assert.equal(demo.public, true)
  assert.ok((demo.file_size_limit ?? 0) >= 55_323_599)

  const { data: listed, error: listError } = await supabase.storage
    .from(BUCKET)
    .list("", { search: OBJECT_PATH, limit: 20 })
  assert.equal(listError, null)
  const object = listed?.find((item) => item.name === OBJECT_PATH)
  assert.ok(object, "bespoke-mobile.apk must exist in demo-downloads")
  assert.equal(Number(object.metadata?.size ?? 0), 55_323_599)

  const local = readFileSync(LOCAL_APK)
  const localSha = createHash("sha256").update(local).digest("hex")
  const { data: downloaded, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(OBJECT_PATH)
  assert.equal(downloadError, null)
  const remote = Buffer.from(await downloaded.arrayBuffer())
  const remoteSha = createHash("sha256").update(remote).digest("hex")
  assert.equal(remote.length, local.length)
  assert.equal(remoteSha, localSha)
})

test("live: /demo 200 and /api/demo/apk redirects to a real APK", async () => {
  const { env } = loadEnv()
  const demoRes = await fetch(`${origin}/demo`, { redirect: "follow" })
  assert.equal(demoRes.status, 200)
  const html = await demoRes.text()
  assert.match(html, /BESPOKE DEMO/)
  assert.match(html, /DESCARGAR BESPOKE MOBILE/)
  assert.match(html, /\/api\/demo\/apk/)
  assert.match(html, /bes-demo/)
  assert.doesNotMatch(html, /demo\.operario@bespoke-app\.com\.ar/)
  assert.match(html, /Versión/)
  assert.match(html, /1\.0\.1/)
  assert.doesNotMatch(html, /service_role/)
  assert.doesNotMatch(html, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(html, /app-abnet\.com\.ar/)
  assert.doesNotMatch(html, /drive\.google/)

  const apkRes = await fetch(`${origin}/api/demo/apk`, {
    redirect: "manual",
  })
  assert.notEqual(apkRes.status, 404)
  assert.equal(apkRes.status, 302)
  const location = apkRes.headers.get("location")
  assert.ok(location)
  assert.match(location, /https:\/\//)
  assert.doesNotMatch(location, /service_role/)

  const fileRes = await fetch(location, { redirect: "follow" })
  assert.equal(fileRes.ok, true)
  const contentType = fileRes.headers.get("content-type") ?? ""
  assert.match(
    contentType,
    /application\/vnd\.android\.package-archive|application\/octet-stream/
  )
  const buf = Buffer.from(await fileRes.arrayBuffer())
  assert.equal(buf.slice(0, 2).toString(), "PK")
  assert.equal(buf.length, 55_323_599)
  const sha = createHash("sha256").update(buf).digest("hex")
  const localSha = createHash("sha256")
    .update(readFileSync(LOCAL_APK))
    .digest("hex")
  assert.equal(sha, localSha)
  assert.equal(contentType.includes("text/html"), false)

  const webPassword = env.match(/^DEMO_WEB_PASSWORD=(.+)$/m)?.[1]?.trim()
  const mobilePassword = env.match(/^DEMO_MOBILE_PASSWORD=(.+)$/m)?.[1]?.trim()
  if (webPassword) {
    assert.match(html, new RegExp(webPassword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
  if (mobilePassword) {
    assert.match(
      html,
      new RegExp(mobilePassword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    )
  }
})
