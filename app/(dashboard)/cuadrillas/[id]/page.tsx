import { CrewDetailPageClient } from "@/components/cuadrillas/crew-detail-page-client"

type CrewDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function CrewDetailPage({ params }: CrewDetailPageProps) {
  const { id } = await params

  return <CrewDetailPageClient id={id} />
}
