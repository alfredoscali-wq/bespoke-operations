import { formatSystemRole } from "@/lib/auth/format-system-role"
import type { SessionUser } from "@/lib/auth/types"
import {
  COMPANY_AREA_LABELS,
  resolveDefaultAreaCodeForSystemRole,
  resolveFixedAreaCode,
} from "@/lib/roles/company-areas"
import type { SystemRole } from "@/lib/types/employees"

/** Snapshot of the authenticated employee who performed an operational action. */
export type OperationalEventActor = {
  userId: string | null
  employeeId: string | null
  fullName: string
  area: string
  role: string
}

export type MobileOperationalActorSource = {
  authUserId: string
  employeeId: string
  displayName: string
  role: SystemRole
  roleCode?: string | null
  roleName?: string | null
}

export const OPERATIONAL_EVENT_ACTOR_PAYLOAD_KEYS = {
  fullName: "actorFullName",
  area: "actorArea",
  role: "actorRole",
} as const

function readPayloadString(
  payload: Record<string, unknown>,
  key: string
): string {
  const value = payload[key]
  return typeof value === "string" ? value.trim() : ""
}

export function resolveOperationalEventAreaLabel(
  sessionUser: Pick<SessionUser, "roleCode" | "roleName" | "systemRole">
): string {
  const roleCode = sessionUser.roleCode?.trim()
  if (roleCode) {
    const areaCode = resolveFixedAreaCode(roleCode)
    if (areaCode) {
      return COMPANY_AREA_LABELS[areaCode]
    }
  }

  const roleName = sessionUser.roleName?.trim()
  if (roleName) {
    return roleName
  }

  if (sessionUser.systemRole) {
    return COMPANY_AREA_LABELS[
      resolveDefaultAreaCodeForSystemRole(sessionUser.systemRole)
    ]
  }

  return ""
}

export function resolveOperationalEventRoleLabel(
  sessionUser: Pick<SessionUser, "roleName" | "systemRole">
): string {
  const roleName = sessionUser.roleName?.trim()
  if (roleName) {
    return roleName
  }

  if (sessionUser.systemRole) {
    return formatSystemRole(sessionUser.systemRole)
  }

  return ""
}

/**
 * Builds the durable actor snapshot from the authenticated session (employees/auth).
 * Does not invent identity — falls back only when session data is incomplete.
 */
export function resolveOperationalEventActor(
  sessionUser: SessionUser | null | undefined,
  fallbackDisplayName?: string | null
): OperationalEventActor {
  const fallback = fallbackDisplayName?.trim() || ""

  if (!sessionUser) {
    return {
      userId: null,
      employeeId: null,
      fullName: fallback || "Sistema",
      area: "",
      role: "",
    }
  }

  const fullName =
    sessionUser.displayName.trim() || fallback || "Usuario"

  return {
    userId: sessionUser.authUserId || null,
    employeeId: sessionUser.employeeId,
    fullName,
    area: resolveOperationalEventAreaLabel(sessionUser),
    role: resolveOperationalEventRoleLabel(sessionUser),
  }
}

/** Actor snapshot for Field Agent / MobileAuthContext. */
export function resolveOperationalEventActorFromMobile(
  auth: MobileOperationalActorSource
): OperationalEventActor {
  const roleCode = auth.roleCode?.trim() || null
  const roleName = auth.roleName?.trim() || null

  return {
    userId: auth.authUserId,
    employeeId: auth.employeeId,
    fullName: auth.displayName.trim() || "Operario",
    area: resolveOperationalEventAreaLabel({
      roleCode,
      roleName,
      systemRole: auth.role,
    }),
    role: resolveOperationalEventRoleLabel({
      roleName,
      systemRole: auth.role,
    }),
  }
}

export function buildOperationalEventActorPayload(
  actor: OperationalEventActor
): Record<string, string> {
  return {
    [OPERATIONAL_EVENT_ACTOR_PAYLOAD_KEYS.fullName]: actor.fullName,
    [OPERATIONAL_EVENT_ACTOR_PAYLOAD_KEYS.area]: actor.area,
    [OPERATIONAL_EVENT_ACTOR_PAYLOAD_KEYS.role]: actor.role,
  }
}

export function applyOperationalEventActor<T extends Record<string, unknown>>(
  event: T & {
    payload?: Record<string, unknown>
    actorUserId?: string | null
    actorEmployeeId?: string | null
    actorDisplayName?: string
  },
  actor: OperationalEventActor
): T & {
  actorUserId: string | null
  actorEmployeeId: string | null
  actorDisplayName: string
  payload: Record<string, unknown>
} {
  return {
    ...event,
    actorUserId: actor.userId,
    actorEmployeeId: actor.employeeId,
    actorDisplayName: actor.fullName,
    payload: {
      ...(event.payload ?? {}),
      ...buildOperationalEventActorPayload(actor),
    },
  }
}

/** Read actor fields for UI — payload first; legacy columns only as fallback. */
export function readOperationalEventActor(event: {
  actorDisplayName: string
  payload: Record<string, unknown> | null | undefined
}): Pick<OperationalEventActor, "fullName" | "area" | "role"> {
  const payload =
    event.payload && typeof event.payload === "object" ? event.payload : {}

  const fullNameFromPayload =
    readPayloadString(payload, OPERATIONAL_EVENT_ACTOR_PAYLOAD_KEYS.fullName) ||
    readPayloadString(payload, "actor_full_name")
  const areaFromPayload =
    readPayloadString(payload, OPERATIONAL_EVENT_ACTOR_PAYLOAD_KEYS.area) ||
    readPayloadString(payload, "actor_area")
  const roleFromPayload =
    readPayloadString(payload, OPERATIONAL_EVENT_ACTOR_PAYLOAD_KEYS.role) ||
    readPayloadString(payload, "actor_role")

  const hasPayloadActor =
    Boolean(fullNameFromPayload) ||
    Boolean(areaFromPayload) ||
    Boolean(roleFromPayload)

  if (hasPayloadActor) {
    return {
      fullName: fullNameFromPayload || event.actorDisplayName.trim() || "Usuario",
      area: areaFromPayload,
      role: roleFromPayload,
    }
  }

  return {
    fullName: event.actorDisplayName.trim() || "Sistema",
    area: "",
    role: "",
  }
}

export function formatOperationalEventActorMeta(actor: {
  area: string
  role: string
}): string {
  if (actor.area && actor.role && actor.area !== actor.role) {
    return `${actor.area} · ${actor.role}`
  }
  return actor.area || actor.role || ""
}

export function formatOperationalEventOccurredParts(
  occurredAt: string,
  locale = "es-MX"
): { date: string; time: string } {
  const parsed = new Date(occurredAt)
  if (Number.isNaN(parsed.getTime())) {
    return { date: occurredAt || "—", time: "" }
  }

  return {
    date: new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(parsed),
    time: new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsed),
  }
}
