import { IspCustomerDetailScreen } from "@/components/isp/isp-customer-detail-screen"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Cliente360DetailPage({ params }: PageProps) {
  const { id } = await params
  return <IspCustomerDetailScreen customerId={id} />
}
