import {
  DEMO_ADMIN_EMAIL,
  DEMO_COMMERCIAL_USERNAME,
  DEMO_OPERARIO_EMAIL,
} from "@/lib/demo/constants"

export { DEMO_COMMERCIAL_USERNAME }

export function isDemoCommercialUsername(identifier: string): boolean {
  return identifier.trim().toLowerCase() === DEMO_COMMERCIAL_USERNAME
}

/**
 * Maps the public username to the Auth email for that surface.
 * Web and Mobile keep distinct Auth users: Operations needs the demo
 * admin (dashboard), Mobile needs the operario (cuadrilla + agenda).
 */
export function resolveDemoCommercialAuthEmail(
  identifier: string,
  surface: "web" | "mobile"
): string | null {
  if (!isDemoCommercialUsername(identifier)) {
    return null
  }

  return surface === "mobile" ? DEMO_OPERARIO_EMAIL : DEMO_ADMIN_EMAIL
}
