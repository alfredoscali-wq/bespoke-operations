import "server-only"

import { createMikrotikAdapter } from "@/lib/integrations/mikrotik/adapter"
import {
  recordMikrotikConnectionTestAudit,
  recordMikrotikIntegrationCreatedAudit,
  recordMikrotikIntegrationToggledAudit,
  recordMikrotikIntegrationUpdatedAudit,
} from "@/lib/integrations/mikrotik/audit"
import { decryptMikrotikPassword, encryptMikrotikPassword } from "@/lib/integrations/mikrotik/crypto"
import {
  isMikrotikIntegrationError,
  MikrotikIntegrationError,
} from "@/lib/integrations/mikrotik/errors"
import {
  getMikrotikIntegrationForCompany,
  getMikrotikIntegrationSecretForCompany,
  insertMikrotikIntegration,
  listMikrotikIntegrationsForCompany,
  softDeleteMikrotikIntegrationForCompany,
  updateMikrotikConnectionState,
  updateMikrotikIntegrationForCompany,
  type MikrotikIntegrationUpdate,
} from "@/lib/integrations/mikrotik/queries"
import { compactRouterIdentity } from "@/lib/integrations/mikrotik/public"
import { shouldResetConnectionState } from "@/lib/integrations/mikrotik/validate"
import type {
  MikrotikCreateInput,
  MikrotikHttpFetch,
  MikrotikIntegrationPublic,
  MikrotikUpdateInput,
} from "@/lib/integrations/mikrotik/types"
import type { SessionUser } from "@/lib/auth/types"
import { createAdminClient } from "@/lib/supabase/admin"

function admin() {
  return createAdminClient()
}

export async function listCompanyMikrotikIntegrations(companyId: string) {
  return listMikrotikIntegrationsForCompany(admin(), companyId)
}

export async function getCompanyMikrotikIntegration(
  companyId: string,
  id: string
) {
  return getMikrotikIntegrationForCompany(admin(), companyId, id)
}

export async function createCompanyMikrotikIntegration(input: {
  companyId: string
  sessionUser: SessionUser
  body: MikrotikCreateInput
}): Promise<MikrotikIntegrationPublic> {
  const created = await insertMikrotikIntegration(admin(), {
    company_id: input.companyId,
    name: input.body.name,
    host: input.body.host,
    port: input.body.port,
    protocol: input.body.protocol,
    username: input.body.username,
    password_encrypted: encryptMikrotikPassword(input.body.password),
    enabled: input.body.enabled,
    last_connection_status: input.body.enabled ? "never_checked" : "disabled",
  })

  await recordMikrotikIntegrationCreatedAudit({
    sessionUser: input.sessionUser,
    companyId: input.companyId,
    integrationId: created.id,
    integrationName: created.name,
    host: created.host,
    protocol: created.protocol,
  })

  return created
}

export async function updateCompanyMikrotikIntegration(input: {
  companyId: string
  id: string
  sessionUser: SessionUser
  body: MikrotikUpdateInput
}): Promise<MikrotikIntegrationPublic> {
  const existing = await getMikrotikIntegrationForCompany(
    admin(),
    input.companyId,
    input.id
  )
  if (!existing) {
    throw new MikrotikIntegrationError("NOT_FOUND", 404)
  }

  const patch: MikrotikIntegrationUpdate = {}
  const changedFields: string[] = []

  if (input.body.name !== undefined) {
    patch.name = input.body.name
    changedFields.push("name")
  }
  if (input.body.host !== undefined) {
    patch.host = input.body.host
    changedFields.push("host")
  }
  if (input.body.port !== undefined) {
    patch.port = input.body.port
    changedFields.push("port")
  }
  if (input.body.protocol !== undefined) {
    patch.protocol = input.body.protocol
    changedFields.push("protocol")
  }
  if (input.body.username !== undefined) {
    patch.username = input.body.username
    changedFields.push("username")
  }
  if (input.body.password !== undefined) {
    patch.password_encrypted = encryptMikrotikPassword(input.body.password)
    changedFields.push("password")
  }
  if (input.body.enabled !== undefined) {
    patch.enabled = input.body.enabled
    changedFields.push("enabled")
  }

  if (shouldResetConnectionState(input.body)) {
    patch.last_connection_at = null
    patch.last_connection_status = input.body.enabled === false ? "disabled" : "never_checked"
    patch.last_connection_error = null
    patch.last_router_identity = null
  } else if (input.body.enabled === false) {
    patch.last_connection_status = "disabled"
  } else if (input.body.enabled === true && existing.lastConnectionStatus === "disabled") {
    patch.last_connection_status = "never_checked"
    patch.last_connection_error = null
  }

  const updated = await updateMikrotikIntegrationForCompany(
    admin(),
    input.companyId,
    input.id,
    patch
  )
  if (!updated) {
    throw new MikrotikIntegrationError("NOT_FOUND", 404)
  }

  if (input.body.enabled !== undefined && input.body.enabled !== existing.enabled) {
    await recordMikrotikIntegrationToggledAudit({
      sessionUser: input.sessionUser,
      companyId: input.companyId,
      integrationId: updated.id,
      integrationName: updated.name,
      enabled: updated.enabled,
    })
  } else {
    await recordMikrotikIntegrationUpdatedAudit({
      sessionUser: input.sessionUser,
      companyId: input.companyId,
      integrationId: updated.id,
      integrationName: updated.name,
      changedFields,
    })
  }

  return updated
}

export async function deleteCompanyMikrotikIntegration(input: {
  companyId: string
  id: string
  sessionUser: SessionUser
}): Promise<void> {
  const existing = await getMikrotikIntegrationForCompany(
    admin(),
    input.companyId,
    input.id
  )
  if (!existing) {
    throw new MikrotikIntegrationError("NOT_FOUND", 404)
  }

  const deleted = await softDeleteMikrotikIntegrationForCompany(
    admin(),
    input.companyId,
    input.id
  )
  if (!deleted) {
    throw new MikrotikIntegrationError("NOT_FOUND", 404)
  }

  await recordMikrotikIntegrationUpdatedAudit({
    sessionUser: input.sessionUser,
    companyId: input.companyId,
    integrationId: existing.id,
    integrationName: existing.name,
    changedFields: ["deleted"],
  })
}

export async function testCompanyMikrotikConnection(input: {
  companyId: string
  id: string
  sessionUser: SessionUser
  fetchImpl?: MikrotikHttpFetch
}): Promise<{
  integration: MikrotikIntegrationPublic
  result: {
    ok: boolean
    identity: string | null
    version: string | null
    uptime: string | null
    cpuLoad: string | null
    freeMemory: number | null
    totalMemory: number | null
    message: string
  }
}> {
  const row = await getMikrotikIntegrationSecretForCompany(
    admin(),
    input.companyId,
    input.id
  )
  if (!row) {
    throw new MikrotikIntegrationError("NOT_FOUND", 404)
  }

  if (!row.enabled) {
    const integration = await updateMikrotikConnectionState(
      admin(),
      input.companyId,
      input.id,
      {
        last_connection_at: new Date().toISOString(),
        last_connection_status: "disabled",
        last_connection_error: new MikrotikIntegrationError("ROUTER_DISABLED").message,
        last_router_identity: row.last_router_identity,
      }
    )
    await recordMikrotikConnectionTestAudit({
      sessionUser: input.sessionUser,
      companyId: input.companyId,
      integrationId: row.id,
      integrationName: row.name,
      result: "error",
      errorCode: "ROUTER_DISABLED",
    })
    throw Object.assign(new MikrotikIntegrationError("ROUTER_DISABLED"), {
      integration,
    })
  }

  let password: string
  try {
    password = decryptMikrotikPassword(row.password_encrypted)
  } catch {
    throw new MikrotikIntegrationError("SECRET_MISSING", 500)
  }

  try {
    const adapter = createMikrotikAdapter({
      host: row.host,
      port: row.port,
      protocol: row.protocol === "https-rest" || row.protocol === "api" || row.protocol === "api-ssl"
        ? row.protocol
        : "https-rest",
      username: row.username,
      password,
      fetchImpl: input.fetchImpl,
    })
    const probed = await adapter.testConnection()
    const snapshot = compactRouterIdentity({
      identity: probed.identity.name,
      version: probed.resource.version,
      uptime: probed.resource.uptime,
      cpuLoad: probed.resource.cpuLoad,
      freeMemory: probed.resource.freeMemory,
      totalMemory: probed.resource.totalMemory,
      boardName: probed.resource.boardName,
      architectureName: probed.resource.architectureName,
      ...(probed.interfaces ? { interfaces: probed.interfaces } : {}),
    })
    const integration = await updateMikrotikConnectionState(
      admin(),
      input.companyId,
      input.id,
      {
        last_connection_at: new Date().toISOString(),
        last_connection_status: "connected",
        last_connection_error: null,
        last_router_identity: snapshot,
      }
    )
    if (!integration) {
      throw new MikrotikIntegrationError("NOT_FOUND", 404)
    }

    await recordMikrotikConnectionTestAudit({
      sessionUser: input.sessionUser,
      companyId: input.companyId,
      integrationId: row.id,
      integrationName: row.name,
      result: "success",
      routerIdentity: snapshot,
    })

    return {
      integration,
      result: {
        ok: true,
        identity: snapshot.identity,
        version: snapshot.version,
        uptime: snapshot.uptime,
        cpuLoad: snapshot.cpuLoad,
        freeMemory: snapshot.freeMemory,
        totalMemory: snapshot.totalMemory,
        message: "Conexion exitosa",
      },
    }
  } catch (error) {
    const typed = isMikrotikIntegrationError(error)
      ? error
      : new MikrotikIntegrationError("CONNECTION_REFUSED")
    const integration = await updateMikrotikConnectionState(
      admin(),
      input.companyId,
      input.id,
      {
        last_connection_at: new Date().toISOString(),
        last_connection_status: "error",
        last_connection_error: typed.message,
        last_router_identity: row.last_router_identity,
      }
    )
    await recordMikrotikConnectionTestAudit({
      sessionUser: input.sessionUser,
      companyId: input.companyId,
      integrationId: row.id,
      integrationName: row.name,
      result: "error",
      errorCode: typed.code,
    })
    throw Object.assign(typed, { integration })
  }
}

export async function getCompanyMikrotikStatus(companyId: string, id: string) {
  const integration = await getCompanyMikrotikIntegration(companyId, id)
  if (!integration) {
    throw new MikrotikIntegrationError("NOT_FOUND", 404)
  }
  return integration
}

export async function getCompanyMikrotikSummary(input: {
  companyId: string
  id: string
  sessionUser: SessionUser
  fetchImpl?: MikrotikHttpFetch
}) {
  return testCompanyMikrotikConnection(input)
}
