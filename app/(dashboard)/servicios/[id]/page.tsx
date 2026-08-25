import { IspCatalogDetailScreen } from "@/components/isp/isp-catalog-detail-screen"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ServicioDetailPage({ params }: PageProps) {
  const { id } = await params
  return <IspCatalogDetailScreen catalogId={id} />
}
