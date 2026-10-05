import type { ModuleVisibilityMap } from "@/lib/roles/app-modules"
import { canAccessNetworkModule } from "@/lib/network/permissions"
import { resolveEffectiveModuleVisibility } from "@/lib/roles/role-utils"
import type { SystemRole } from "@/lib/types/employees"

export type NetworkAlarmPushCandidate = {
  companyId: string
  userId: string
  pushToken: string
  enabled: boolean
  deletedAt: string | null
  employeeCompanyId: string | null
  employeeDeletedAt: string | null
  systemRole: string | null
  roleCode: string | null
  moduleVisibility: Partial<ModuleVisibilityMap> | null
}

export type NetworkAlarmPushRecipient = {
  userId: string
  pushToken: string
}

function isSystemRole(value: string | null): value is SystemRole {
  return (
    value === "administrador" ||
    value === "supervisor" ||
    value === "administrativo" ||
    value === "operario" ||
    value === "demo"
  )
}

export function candidateHasNetworkModuleAccess(
  candidate: Pick<
    NetworkAlarmPushCandidate,
    "systemRole" | "roleCode" | "moduleVisibility"
  >
): boolean {
  const roleCode = candidate.roleCode?.trim() || null
  return canAccessNetworkModule({
    systemRole: isSystemRole(candidate.systemRole) ? candidate.systemRole : null,
    roleCode,
    moduleVisibility: resolveEffectiveModuleVisibility({
      code: roleCode ?? "",
      moduleVisibility: candidate.moduleVisibility,
    }),
  })
}

export function selectNetworkAlarmPushRecipients(
  alarmCompanyId: string,
  candidates: readonly NetworkAlarmPushCandidate[]
): NetworkAlarmPushRecipient[] {
  const companyId = alarmCompanyId.trim()
  if (!companyId) return []

  const seenTokens = new Set<string>()
  const recipients: NetworkAlarmPushRecipient[] = []

  for (const candidate of candidates) {
    const pushToken = candidate.pushToken.trim()
    if (!pushToken) continue
    if (seenTokens.has(pushToken)) continue
    if (candidate.companyId !== companyId) continue
    if (candidate.employeeCompanyId !== companyId) continue
    if (!candidate.enabled) continue
    if (candidate.deletedAt != null) continue
    if (candidate.employeeDeletedAt != null) continue
    if (!candidateHasNetworkModuleAccess(candidate)) continue

    seenTokens.add(pushToken)
    recipients.push({
      userId: candidate.userId,
      pushToken,
    })
  }

  return recipients
}
