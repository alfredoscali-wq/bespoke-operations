import { CustomerDetailScreen } from "@/components/clientes/customer-detail-screen"

type CustomerDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params

  return <CustomerDetailScreen customerId={id} />
}
