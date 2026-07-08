import { AtencionDetailScreen } from "@/components/atencion-cliente/atencion-detail-screen"

type AtencionDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function AtencionDetailPage({
  params,
}: AtencionDetailPageProps) {
  const { id } = await params

  return <AtencionDetailScreen atencionId={id} />
}
