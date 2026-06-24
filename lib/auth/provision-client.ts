export type ProvisionEmployeeAccessResponse =
  | { success: true; authUserId: string }
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

  if (!response.ok) {
    return {
      success: false,
      error:
        "error" in data && data.error
          ? data.error
          : "No se pudo crear el acceso del empleado.",
    }
  }

  return data
}
