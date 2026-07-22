import { ContractorDetailPageClient } from "@/components/contratistas/contractor-detail-page-client"

type ContractorDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function ContractorDetailPage({
  params,
}: ContractorDetailPageProps) {
  const { id } = await params
  return <ContractorDetailPageClient contractorId={id} />
}
