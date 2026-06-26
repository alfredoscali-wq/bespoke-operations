"use client"

import {
  AUDIT_ACTION_BADGE_CLASSES,
  AUDIT_ACTION_VISUAL_GROUP_LABELS,
  resolveAuditActionVisualGroup,
} from "@/lib/audit/action-badges"
import { formatAuditActionLabel } from "@/lib/audit/audit-labels"
import type { AuditLogEntry } from "@/lib/audit/types"
import { cn } from "@/lib/utils"

type AuditActionBadgeProps = {
  entry: Pick<AuditLogEntry, "action" | "severity">
  className?: string
}

export function AuditActionBadge({ entry, className }: AuditActionBadgeProps) {
  const group = resolveAuditActionVisualGroup(entry.action, entry.severity)

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        AUDIT_ACTION_BADGE_CLASSES[group],
        className
      )}
    >
      {formatAuditActionLabel(entry.action)}
    </span>
  )
}

export function AuditActionGroupBadge({
  action,
  severity,
  className,
}: {
  action: string
  severity?: string
  className?: string
}) {
  const group = resolveAuditActionVisualGroup(action, severity)

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        AUDIT_ACTION_BADGE_CLASSES[group],
        className
      )}
    >
      {AUDIT_ACTION_VISUAL_GROUP_LABELS[group]}
    </span>
  )
}
