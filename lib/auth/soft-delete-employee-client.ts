export type SoftDeleteEmployeeAccessResponse =
  | { success: true }
  | { success: false; error: string }

export async function requestSoftDeleteEmployeeAccess(
  employeeId: string
): Promise<SoftDeleteEmployeeAccessResponse> {
  const response = await fetch("/api/auth/soft-delete-employee", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ employeeId }),
  })

  const data = (await response.json()) as SoftDeleteEmployeeAccessResponse

  if (!response.ok) {
    return {
      success: false,
      error:
        "error" in data && data.error
          ? data.error
          : "No se pudo eliminar el usuario.",
    }
  }

  return data
}
