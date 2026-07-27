import type { SessionUser } from "@/lib/auth/session"
import type { AttachmentModule } from "@/lib/attachments/constants"
import { canAccessAtencionClienteModule } from "@/lib/customer-atenciones/module-access"

export function canUploadAttachments(
  sessionUser: SessionUser,
  module: AttachmentModule
): boolean {
  return canAccessAttachmentModule(sessionUser, module)
}

export function canViewAttachments(
  sessionUser: SessionUser,
  module: AttachmentModule
): boolean {
  return canAccessAttachmentModule(sessionUser, module)
}

export function canDeleteAttachments(sessionUser: SessionUser): boolean {
  return sessionUser.systemRole === "administrador"
}

function canAccessAttachmentModule(
  sessionUser: SessionUser,
  module: AttachmentModule
): boolean {
  switch (module) {
    case "customer_attention":
      return canAccessAtencionClienteModule(sessionUser)
    case "commercial":
    case "projects":
    case "tasks":
    case "employees":
    case "customers":
      // Reserved for future module integrations — deny until wired.
      return false
    default:
      return false
  }
}
