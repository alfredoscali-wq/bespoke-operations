/**
 * Server-only Firebase Admin. Never import from Client Components.
 * Reads FIREBASE_SERVICE_ACCOUNT_JSON only. Never log the credential.
 */

import { cert, getApps, initializeApp, type App } from "firebase-admin/app"

import {
  firebaseAdminUnavailableMessage,
  readFirebaseServiceAccountFromEnv,
} from "@/lib/firebase/service-account"

export type FirebaseAdminState =
  | { status: "ready"; app: App }
  | { status: "unavailable"; reason: string }

let cached: FirebaseAdminState | null = null

export function getFirebaseAdminApp(): FirebaseAdminState {
  if (cached) return cached

  const parsed = readFirebaseServiceAccountFromEnv()
  if (!parsed.ok) {
    cached = { status: "unavailable", reason: parsed.reason }
    console.error("[firebase-admin]", firebaseAdminUnavailableMessage(parsed.reason))
    return cached
  }

  try {
    const existing = getApps()[0]
    const app =
      existing ??
      initializeApp({
        credential: cert({
          projectId: parsed.credential.projectId,
          clientEmail: parsed.credential.clientEmail,
          privateKey: parsed.credential.privateKey,
        }),
        projectId: parsed.credential.projectId,
      })
    cached = { status: "ready", app }
    return cached
  } catch {
    cached = { status: "unavailable", reason: "initialize_failed" }
    console.error(
      "[firebase-admin]",
      firebaseAdminUnavailableMessage("initialize_failed")
    )
    return cached
  }
}
