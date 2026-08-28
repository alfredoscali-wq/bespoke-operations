import { MaterialDetailPageClient } from "@/components/materiales/material-detail-page-client"

type MaterialDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ warehouse?: string }>
}

export default async function MaterialDetailPage({
  params,
  searchParams,
}: MaterialDetailPageProps) {
  const { id } = await params
  const { warehouse } = await searchParams

  return (
    <MaterialDetailPageClient id={id} warehouseId={warehouse?.trim() || undefined} />
  )
}
