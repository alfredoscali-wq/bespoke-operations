import { EmployeeDetailPageClient } from "@/components/rrhh/employee-detail-page-client"

type EmployeeDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function EmployeeDetailPage({
  params,
}: EmployeeDetailPageProps) {
  const { id } = await params

  return <EmployeeDetailPageClient id={id} />
}
