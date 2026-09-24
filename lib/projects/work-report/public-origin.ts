/**
 * Public/share URLs always use the Bespoke platform origin — never the
 * tenant operations host (for example app-abnet.com.ar).
 *
 * Override with BESPOKE_PUBLIC_REPORT_ORIGIN when the general Bespoke
 * domain changes. Do not derive this from the incoming request Host.
 */
export const DEFAULT_BESPOKE_PUBLIC_REPORT_ORIGIN = "https://bespoke-app.online"

export function getBespokePublicReportOrigin(
  env: NodeJS.ProcessEnv = process.env
): string {
  const configured =
    env.BESPOKE_PUBLIC_REPORT_ORIGIN?.trim() ||
    env.NEXT_PUBLIC_BESPOKE_PUBLIC_REPORT_ORIGIN?.trim() ||
    ""

  if (!configured) {
    return DEFAULT_BESPOKE_PUBLIC_REPORT_ORIGIN
  }

  return configured.replace(/\/+$/, "")
}

export function buildProjectWorkReportShareUrl(
  token: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const safeToken = token.trim()
  return `${getBespokePublicReportOrigin(env)}/informe/${encodeURIComponent(safeToken)}`
}

export function isTenantOperationsHost(host: string | null | undefined): boolean {
  const normalized = (host ?? "").trim().toLowerCase().replace(/:\d+$/, "")
  return (
    normalized === "app-abnet.com.ar" ||
    normalized.endsWith(".app-abnet.com.ar")
  )
}
