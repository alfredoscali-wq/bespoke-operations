export type ProvisionEmployeeAccessResponse =
  | {
      success: true
      authUserId: string
      reused?: boolean
      created?: boolean
      temporaryPassword?: string
    }
  | { success: false; error: string }

export async function requestProvisionEmployeeAccess(
  employeeId: string
): Promise<ProvisionEmployeeAccessResponse> {
  const response = await fetch("/api/auth/provision", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ employeeId }),
  })

  const data = (await response.json()) as ProvisionEmployeeAccessResponse

  if (!response.ok || !data.success) {
    return {
      success: false,
      error:
        "error" in data && data.error
          ? data.error
          : "No se pudo provisionar el acceso del empleado.",
    }
  }

  return {
    success: true,
    authUserId: data.authUserId,
    reused: data.reused,
    created: data.created,
    ...(data.temporaryPassword
      ? { temporaryPassword: data.temporaryPassword }
      : {}),
  }
}
