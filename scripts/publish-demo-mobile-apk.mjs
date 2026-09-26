/**
 * Ops tool: publish the local Bespoke Mobile Release APK to Supabase Storage.
 * Credentials come from .env.local — never hardcode service_role.
 *
 * Usage:
 *   npx tsx scripts/publish-demo-mobile-apk.mjs
 *   npx tsx scripts/publish-demo-mobile-apk.mjs --source="C:/path/Bespoke-Mobile.apk"
 */
import { createHash } from "node:crypto"
import { existsSync, readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

const BUCKET = "demo-downloads"
const OBJECT_PATH = "bespoke-mobile.apk"
const APK_CONTENT_TYPE = "application/vnd.android.package-archive"
const FILE_SIZE_LIMIT = 104_857_600
const EXPECTED_SHA256 =
  "e1ef1deafcd47600988ce379fafbbff5461efb1cf056834bdcfbf72463241c37"
const PROTECTED_BUCKETS = new Set([
  "evidences",
  "task-photos",
  "automatic-reports",
  "task-incident-photos",
  "treasury-receipts",
  "attachments",
  "isp-billing-logos",
  "company-branding-logos",
])

const DEFAULT_SOURCES = [
  resolve(process.cwd(), "downloads/bespoke-mobile.apk"),
  resolve(process.cwd(), "downloads/Bespoke-Mobile.apk"),
  "C:/Users/alfre/Downloads/Bespoke-Mobile.apk",
]

function loadEnv() {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8")
  const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim()
  const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim()
  const dbUrl =
    env.match(/^SUPABASE_DB_URL=(.+)$/m)?.[1]?.trim() ||
    env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim()
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    )
  }
  return { url, key, dbUrl }
}

function arg(name) {
  const prefix = `--${name}=`
  const found = process.argv.find((value) => value.startsWith(prefix))
  return found ? found.slice(prefix.length) : null
}

function resolveSourceApk() {
  const fromArg = arg("source")
  const candidates = fromArg ? [fromArg, ...DEFAULT_SOURCES] : DEFAULT_SOURCES
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }
  throw new Error(
    [
      "No se encontró la APK local.",
      "Copiá el Release a Downloads o pasá --source=ruta/al/archivo.apk",
      `Candidatos: ${candidates.join(", ")}`,
    ].join("\n")
  )
}

async function applyBucketSql(dbUrl) {
  if (dbUrl) {
    const postgres = (await import("postgres")).default
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20261229000100_demo_downloads_storage.sql"
      ),
      "utf8"
    )
    const client = postgres(dbUrl, { max: 1 })
    try {
      await client.unsafe(sql)
      return { applied: true, via: "postgres" }
    } finally {
      await client.end({ timeout: 5 })
    }
  }

  const { spawnSync } = await import("node:child_process")
  const result = spawnSync(
    "npx",
    [
      "supabase",
      "db",
      "query",
      "--linked",
      "--yes",
      "-f",
      "supabase/migrations/20261229000100_demo_downloads_storage.sql",
    ],
    { encoding: "utf8", shell: true }
  )
  if (result.status !== 0) {
    return {
      applied: false,
      reason: result.stderr || result.stdout || "supabase db query failed",
    }
  }
  return { applied: true, via: "supabase-cli" }
}

async function ensureDemoDownloadsBucket(supabase) {
  const { data: buckets, error } = await supabase.storage.listBuckets()
  if (error) {
    throw new Error(`listBuckets: ${error.message}`)
  }

  for (const bucket of buckets ?? []) {
    if (PROTECTED_BUCKETS.has(bucket.id) || PROTECTED_BUCKETS.has(bucket.name)) {
      continue
    }
  }

  const existing = (buckets ?? []).find(
    (bucket) => bucket.id === BUCKET || bucket.name === BUCKET
  )

  if (!existing) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: FILE_SIZE_LIMIT,
      allowedMimeTypes: [APK_CONTENT_TYPE, "application/octet-stream"],
    })
    if (createError) {
      const { error: fallbackError } = await supabase.storage.createBucket(
        BUCKET,
        {
          public: true,
          allowedMimeTypes: [APK_CONTENT_TYPE, "application/octet-stream"],
        }
      )
      if (fallbackError && !/already exists/i.test(fallbackError.message)) {
        throw new Error(
          `createBucket: ${createError.message}; fallback: ${fallbackError.message}`
        )
      }
      console.log(
        "created bucket",
        BUCKET,
        createError ? "(without API size limit; SQL should set 100MB)" : ""
      )
      return
    }
    console.log("created bucket", BUCKET)
    return
  }

  const needsUpdate =
    existing.public !== true ||
    (existing.file_size_limit ?? 0) < FILE_SIZE_LIMIT

  if (needsUpdate) {
    const { error: updateError } = await supabase.storage.updateBucket(BUCKET, {
      public: true,
      fileSizeLimit: FILE_SIZE_LIMIT,
      allowedMimeTypes: [APK_CONTENT_TYPE, "application/octet-stream"],
    })
    if (updateError) {
      throw new Error(`updateBucket: ${updateError.message}`)
    }
    console.log("updated bucket", BUCKET)
  } else {
    console.log("reusing bucket", BUCKET)
  }
}

async function main() {
  const { url, key, dbUrl } = loadEnv()
  const sourcePath = resolveSourceApk()
  const stat = statSync(sourcePath)
  const file = readFileSync(sourcePath)
  const sha256 = createHash("sha256").update(file).digest("hex")

  if (file.slice(0, 2).toString() !== "PK") {
    throw new Error(`${sourcePath} is not a ZIP/APK`)
  }
  if (sha256 !== EXPECTED_SHA256) {
    console.warn(
      `SHA-256 differs from inspected Release (${EXPECTED_SHA256}). Uploading this file as-is: ${sha256}`
    )
  }

  console.log("source", sourcePath)
  console.log("size", stat.size)
  console.log("sha256", sha256)

  const sqlResult = await applyBucketSql(dbUrl)
  console.log("sql migration", sqlResult)

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  await ensureDemoDownloadsBucket(supabase)

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(OBJECT_PATH, file, {
      contentType: APK_CONTENT_TYPE,
      upsert: true,
      cacheControl: "3600",
    })

  if (uploadError) {
    throw new Error(`upload: ${uploadError.message}`)
  }

  const { data: listed, error: listError } = await supabase.storage
    .from(BUCKET)
    .list("", { search: OBJECT_PATH, limit: 20 })
  if (listError) {
    throw new Error(`list: ${listError.message}`)
  }
  const object = listed?.find((item) => item.name === OBJECT_PATH)
  if (!object) {
    throw new Error("Upload succeeded but object was not listed")
  }

  const remoteSize = Number(object.metadata?.size ?? 0)
  console.log("storage object", OBJECT_PATH, "size", remoteSize)

  const { data: downloaded, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(OBJECT_PATH)
  if (downloadError || !downloaded) {
    throw new Error(`download verify: ${downloadError?.message ?? "empty"}`)
  }
  const remoteBuf = Buffer.from(await downloaded.arrayBuffer())
  const remoteSha = createHash("sha256").update(remoteBuf).digest("hex")
  if (remoteSha !== sha256) {
    throw new Error(
      `Storage SHA-256 mismatch. local=${sha256} remote=${remoteSha}`
    )
  }
  if (remoteBuf.length !== stat.size) {
    throw new Error(
      `Storage size mismatch. local=${stat.size} remote=${remoteBuf.length}`
    )
  }

  const { data: publicData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(OBJECT_PATH)
  const publicUrl = publicData.publicUrl

  let publicReachable = false
  try {
    const head = await fetch(publicUrl, { method: "HEAD", redirect: "follow" })
    publicReachable = head.ok
    console.log("public HEAD", head.status, head.headers.get("content-type"))
  } catch (error) {
    console.log("public HEAD failed", error.message)
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(OBJECT_PATH, 3600, { download: OBJECT_PATH })
  if (signError || !signed?.signedUrl) {
    throw new Error(`createSignedUrl: ${signError?.message ?? "empty"}`)
  }

  console.log(
    JSON.stringify(
      {
        bucket: BUCKET,
        path: OBJECT_PATH,
        size: stat.size,
        sha256,
        publicUrl,
        publicReachable,
        signedUrlIssued: true,
      },
      null,
      2
    )
  )

  if (!publicReachable && !dbUrl) {
    console.log(
      [
        "",
        "El objeto está subido, pero la URL pública todavía no es accesible.",
        "El backend usará URL firmada. Para lectura pública permanente,",
        "ejecutá en Supabase → SQL Editor el archivo:",
        "supabase/migrations/20261229000100_demo_downloads_storage.sql",
      ].join("\n")
    )
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
