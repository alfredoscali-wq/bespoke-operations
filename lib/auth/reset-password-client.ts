export type ResetEmployeePasswordResponse =
  | { success: true }
  | { success: false; error: string }

export async function requestResetEmployeePassword(
  employeeId: string
): Promise<ResetEmployeePasswordResponse> {
  const response = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ employeeId }),
  })

  const data = (await response.json()) as ResetEmployeePasswordResponse

  if (!response.ok) {
    return {
      success: false,
      error:
        "error" in data && data.error
          ? data.error
          : "No se pudo restablecer la contraseña del empleado.",
    }
  }

  return data
}
