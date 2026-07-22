export type HardDeleteContractorClientResult =
  | { success: true; legalName: string }
  | { success: false; error: string }

export async function requestHardDeleteContractor(
  contractorId: string
): Promise<HardDeleteContractorClientResult> {
  const response = await fetch("/api/admin/hard-delete-contractor", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contractorId }),
  })

  const data = (await response.json()) as {
    success?: boolean
    error?: string
    legalName?: string
  }

  if (!response.ok || !data.success) {
    return {
      success: false,
      error: data.error ?? "No se pudo eliminar definitivamente el contratista.",
    }
  }

  return {
    success: true,
    legalName: data.legalName ?? contractorId,
  }
}
