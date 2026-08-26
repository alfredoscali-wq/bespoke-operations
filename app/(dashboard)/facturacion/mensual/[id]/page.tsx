import { IspBillingMonthlyReviewScreen } from "@/components/isp/isp-billing-monthly-review-screen"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function FacturacionMensualDetallePage({ params }: PageProps) {
  const { id } = await params
  return <IspBillingMonthlyReviewScreen runId={id} />
}
