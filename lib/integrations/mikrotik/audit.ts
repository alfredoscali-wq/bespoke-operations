import "server-only"

import { buildAuditDescription } from "@/lib/audit/build-audit-description"
import { recordAuditEventServer } from "@/lib/audit/record-audit-event.server"
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
  AUDIT_SEVERITIES,
} from "@/lib/audit/types"
import type { SessionUser } from "@/lib/auth/types"
import { compactRouterIdentity } from "@/lib/integrations/mikrotik/public"
import { stripMikrotikSecrets } from "@/lib/integrations/mikrotik/errors"
import type { MikrotikRouterIdentity } from "@/lib/integrations/mikrotik/types"

type MikrotikAuditAction =
  | typeof AUDIT_ACTIONS.MIKROTIK_INTEGRATION_CREATED
  | typeof AUDIT_ACTIONS.MIKROTIK_INTEGRATION_UPDATED
  | typeof AUDIT_ACTIONS.MIKROTIK_INTEGRATION_TOGGLED
  | typeof AUDIT_ACTIONS.MIKROTIK_CONNECTION_TEST

async function recordMikrotikAudit(input: {
  action: MikrotikAuditAction
  sessionUser: SessionUser
  companyId: string
  integrationId: string
  integrationName: string
  descriptionFallback: string
  metadata: Record<string, unknown>
}) {
  await recordAuditEventServer({
    module: AUDIT_MODULES.SISTEMA,
    action: input.action,
    entityType: AUDIT_ENTITY_TYPES.MIKROTIK_INTEGRATION,
    entityId: input.integrationId,
    entityLabel: input.integrationName,
    description: buildAuditDescription({
      action: input.action,
      entityLabel: input.integrationName,
      fallback: input.descriptionFallback,
    }),
    severity:
      input.action === AUDIT_ACTIONS.MIKROTIK_CONNECTION_TEST
        ? AUDIT_SEVERITIES.INFO
        : AUDIT_SEVERITIES.WARNING,
    performedBy: { kind: "user", sessionUser: input.sessionUser },
    companyId: input.companyId,
    metadata: stripMikrotikSecrets(input.metadata) as Record<string, unknown>,
  })
}

export async function recordMikrotikIntegrationCreatedAudit(input: {
  sessionUser: SessionUser
  companyId: string
  integrationId: string
  integrationName: string
  host: string
  protocol: string
}) {
  await recordMikrotikAudit({
    action: AUDIT_ACTIONS.MIKROTIK_INTEGRATION_CREATED,
    sessionUser: input.sessionUser,
    companyId: input.companyId,
    integrationId: input.integrationId,
    integrationName: input.integrationName,
    descriptionFallback: "Integracion MikroTik creada: " + input.integrationName + ".",
    metadata: {
      integrationId: input.integrationId,
      host: input.host,
      protocol: input.protocol,
    },
  })
}

export async function recordMikrotikIntegrationUpdatedAudit(input: {
  sessionUser: SessionUser
  companyId: string
  integrationId: string
  integrationName: string
  changedFields: string[]
}) {
  await recordMikrotikAudit({
    action: AUDIT_ACTIONS.MIKROTIK_INTEGRATION_UPDATED,
    sessionUser: input.sessionUser,
    companyId: input.companyId,
    integrationId: input.integrationId,
    integrationName: input.integrationName,
    descriptionFallback: "Integracion MikroTik modificada: " + input.integrationName + ".",
    metadata: {
      integrationId: input.integrationId,
      changedFields: input.changedFields,
    },
  })
}

export async function recordMikrotikIntegrationToggledAudit(input: {
  sessionUser: SessionUser
  companyId: string
  integrationId: string
  integrationName: string
  enabled: boolean
}) {
  await recordMikrotikAudit({
    action: AUDIT_ACTIONS.MIKROTIK_INTEGRATION_TOGGLED,
    sessionUser: input.sessionUser,
    companyId: input.companyId,
    integrationId: input.integrationId,
    integrationName: input.integrationName,
    descriptionFallback: input.enabled
      ? "Integracion MikroTik habilitada: " + input.integrationName + "."
      : "Integracion MikroTik deshabilitada: " + input.integrationName + ".",
    metadata: {
      integrationId: input.integrationId,
      enabled: input.enabled,
    },
  })
}

export async function recordMikrotikConnectionTestAudit(input: {
  sessionUser: SessionUser
  companyId: string
  integrationId: string
  integrationName: string
  result: "success" | "error"
  routerIdentity?: MikrotikRouterIdentity | null
  errorCode?: string | null
}) {
  const snapshot = input.routerIdentity
    ? compactRouterIdentity(input.routerIdentity)
    : null
  await recordMikrotikAudit({
    action: AUDIT_ACTIONS.MIKROTIK_CONNECTION_TEST,
    sessionUser: input.sessionUser,
    companyId: input.companyId,
    integrationId: input.integrationId,
    integrationName: input.integrationName,
    descriptionFallback:
      input.result === "success"
        ? "Prueba de conexion MikroTik exitosa: " + input.integrationName + "."
        : "Prueba de conexion MikroTik fallida: " + input.integrationName + ".",
    metadata: {
      integrationId: input.integrationId,
      result: input.result,
      routerIdentity: snapshot?.identity ?? null,
      routerVersion: snapshot?.version ?? null,
      errorCode: input.errorCode ?? null,
    },
  })
}
