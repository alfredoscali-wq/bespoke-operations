export const EXPECTED_FIREBASE_PROJECT_ID = "bespoke-cb1b0"
export const FIREBASE_SERVICE_ACCOUNT_ENV = "FIREBASE_SERVICE_ACCOUNT_JSON"

export type FirebaseServiceAccountCredential = {
  projectId: string
  clientEmail: string
  privateKey: string
}

export type FirebaseServiceAccountParseResult =
  | { ok: true; credential: FirebaseServiceAccountCredential }
  | {
      ok: false
      reason:
        | "missing"
        | "invalid_json"
        | "invalid_fields"
        | "project_mismatch"
    }

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n")
}

function asServiceAccountRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

export function parseFirebaseServiceAccountJson(
  raw: string | null | undefined
): FirebaseServiceAccountParseResult {
  if (raw == null || raw.trim() === "") {
    return { ok: false, reason: "missing" }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed)
    }
  } catch {
    return { ok: false, reason: "invalid_json" }
  }

  const record = asServiceAccountRecord(parsed)
  if (!record) {
    return { ok: false, reason: "invalid_fields" }
  }

  const projectId = readNonEmptyString(record.project_id)
  const clientEmail = readNonEmptyString(record.client_email)
  const privateKeyRaw = readNonEmptyString(record.private_key)
  if (!projectId || !clientEmail || !privateKeyRaw) {
    return { ok: false, reason: "invalid_fields" }
  }

  if (projectId !== EXPECTED_FIREBASE_PROJECT_ID) {
    return { ok: false, reason: "project_mismatch" }
  }

  return {
    ok: true,
    credential: {
      projectId,
      clientEmail,
      privateKey: normalizePrivateKey(privateKeyRaw),
    },
  }
}

export function readFirebaseServiceAccountFromEnv(
  env: NodeJS.ProcessEnv = process.env
): FirebaseServiceAccountParseResult {
  return parseFirebaseServiceAccountJson(env[FIREBASE_SERVICE_ACCOUNT_ENV])
}

export function firebaseAdminUnavailableMessage(reason: string): string {
  switch (reason) {
    case "missing":
      return "Firebase Admin is not configured: FIREBASE_SERVICE_ACCOUNT_JSON is missing."
    case "invalid_json":
      return "Firebase Admin is not configured: FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON."
    case "invalid_fields":
      return "Firebase Admin is not configured: FIREBASE_SERVICE_ACCOUNT_JSON is missing required fields."
    case "project_mismatch":
      return "Firebase Admin is not configured: service account project_id does not match the expected Firebase project."
    case "initialize_failed":
      return "Firebase Admin could not be initialized."
    default:
      return "Firebase Admin is not configured."
  }
}
