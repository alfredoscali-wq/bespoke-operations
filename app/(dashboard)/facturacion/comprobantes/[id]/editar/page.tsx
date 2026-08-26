import { IspBillingDocumentFormScreen } from "@/components/isp/isp-billing-document-form-screen"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function EditarComprobantePage({ params }: PageProps) {
  const { id } = await params
  return <IspBillingDocumentFormScreen documentId={id} />
}
