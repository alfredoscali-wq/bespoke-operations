export async function syncEmployeeMetadataClient(employeeId: string) {
  await fetch("/api/auth/sync-employee-metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId }),
  })
}
