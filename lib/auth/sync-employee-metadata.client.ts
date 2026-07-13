export type SyncEmployeeMetadataResult =
  | { success: true }
  | { success: false; message: string }

export type SyncRoleMetadataResult =
  | {
      success: true
      syncedCount: number
      skippedWithoutAppUser: number
    }
  | { success: false; message: string }

async function readSyncErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string }
    return (
      body.message?.trim() ||
      "No fue posible sincronizar la metadata de acceso del usuario."
    )
  } catch {
    return "No fue posible sincronizar la metadata de acceso del usuario."
  }
}

export async function syncMyMetadataClient(): Promise<SyncEmployeeMetadataResult> {
  const response = await fetch("/api/auth/sync-my-metadata", {
    method: "POST",
  })

  if (!response.ok) {
    return {
      success: false,
      message: await readSyncErrorMessage(response),
    }
  }

  return { success: true }
}

export async function syncEmployeeMetadataClient(
  employeeId: string
): Promise<SyncEmployeeMetadataResult> {
  const response = await fetch("/api/auth/sync-employee-metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId }),
  })

  if (!response.ok) {
    return {
      success: false,
      message: await readSyncErrorMessage(response),
    }
  }

  return { success: true }
}

export async function syncRoleMetadataClient(
  roleId: string
): Promise<SyncRoleMetadataResult> {
  const response = await fetch("/api/auth/sync-role-metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roleId }),
  })

  if (!response.ok) {
    return {
      success: false,
      message: await readSyncErrorMessage(response),
    }
  }

  const body = (await response.json()) as {
    syncedCount?: number
    skippedWithoutAppUser?: number
  }

  return {
    success: true,
    syncedCount: body.syncedCount ?? 0,
    skippedWithoutAppUser: body.skippedWithoutAppUser ?? 0,
  }
}
