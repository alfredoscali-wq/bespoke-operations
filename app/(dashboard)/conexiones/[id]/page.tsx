import { IspConnectionDetailScreen } from "@/components/isp/isp-connection-detail-screen"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ConexionDetailPage({ params }: PageProps) {
  const { id } = await params
  return <IspConnectionDetailScreen connectionId={id} />
}
