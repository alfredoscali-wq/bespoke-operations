import type { SessionUser } from "@/lib/auth/types"
import {
  hasWebModuleAccess,
  isAdministradorSessionUser,
} from "@/lib/roles/web-module-access"

type SessionLike =
  | Pick<SessionUser, "systemRole" | "roleCode" | "moduleVisibility">
  | null
  | undefined

export function canAccessIspModule(
  sessionUser: Pick<SessionUser, "systemRole" | "roleCode" | "moduleVisibility"> | null | undefined
): boolean {
  return hasWebModuleAccess(sessionUser, "clientes_360")
}

export function canWriteIspModule(
  sessionUser: Pick<SessionUser, "systemRole" | "roleCode" | "moduleVisibility"> | null | undefined
): boolean {
  return canAccessIspModule(sessionUser)
}

export function canReadIspCatalogForOt(
  sessionUser: Pick<SessionUser, "systemRole" | "roleCode" | "moduleVisibility"> | null | undefined
): boolean {
  return (
    canAccessIspModule(sessionUser) ||
    hasWebModuleAccess(sessionUser, "work_orders")
  )
}

export function canAccessIspMigration(
  sessionUser: Pick<SessionUser, "systemRole" | "roleCode" | "moduleVisibility"> | null | undefined
): boolean {
  return (
    hasWebModuleAccess(sessionUser, "maintenance") ||
    hasWebModuleAccess(sessionUser, "clientes_360")
  )
}

export function canWriteIspMigration(
  sessionUser: Pick<SessionUser, "systemRole" | "roleCode" | "moduleVisibility"> | null | undefined
): boolean {
  return canAccessIspMigration(sessionUser)
}

export function canEditIspSubscriber(sessionUser: SessionLike): boolean {
  return canWriteIspModule(sessionUser)
}

export function canAddIspSubscriberService(sessionUser: SessionLike): boolean {
  return canWriteIspModule(sessionUser)
}

export function canCreateIspAtencion(sessionUser: SessionLike): boolean {
  return hasWebModuleAccess(sessionUser, "atencion_cliente")
}

export function canRemoveIspSubscriber(sessionUser: SessionLike): boolean {
  return isAdministradorSessionUser(sessionUser)
}

export function canAccessIspBilling(
  sessionUser: Pick<SessionUser, "systemRole" | "roleCode" | "moduleVisibility"> | null | undefined
): boolean {
  return hasWebModuleAccess(sessionUser, "facturacion")
}

export function canWriteIspBilling(
  sessionUser: Pick<SessionUser, "systemRole" | "roleCode" | "moduleVisibility"> | null | undefined
): boolean {
  return canAccessIspBilling(sessionUser)
}
