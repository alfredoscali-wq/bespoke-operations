import { IspBillingDocumentDetailScreen } from "@/components/isp/isp-billing-document-detail-screen"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ComprobanteDetailPage({ params }: PageProps) {
  const { id } = await params
  return <IspBillingDocumentDetailScreen documentId={id} />
}
