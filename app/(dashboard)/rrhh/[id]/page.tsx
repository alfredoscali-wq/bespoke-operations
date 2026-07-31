import { Suspense } from "react"

import { EmployeeDetailPageClient } from "@/components/rrhh/employee-detail-page-client"
import { Skeleton } from "@/components/ui/skeleton"

type EmployeeDetailPageProps = {
  params: Promise<{ id: string }>
}

function EmployeeDetailFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  )
}

export default async function EmployeeDetailPage({
  params,
}: EmployeeDetailPageProps) {
  const { id } = await params

  return (
    <Suspense fallback={<EmployeeDetailFallback />}>
      <EmployeeDetailPageClient id={id} />
    </Suspense>
  )
}
