import { EvidenceDetailPageClient } from "@/components/evidencias/evidence-detail-page-client"

type EvidenceDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function EvidenceDetailPage({
  params,
}: EvidenceDetailPageProps) {
  const { id } = await params

  return <EvidenceDetailPageClient id={id} />
}
