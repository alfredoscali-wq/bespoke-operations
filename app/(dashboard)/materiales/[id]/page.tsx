import { MaterialDetailPageClient } from "@/components/materiales/material-detail-page-client"

type MaterialDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function MaterialDetailPage({
  params,
}: MaterialDetailPageProps) {
  const { id } = await params

  return <MaterialDetailPageClient id={id} />
}
