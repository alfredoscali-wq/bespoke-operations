import { IspCatalogFormScreen } from "@/components/isp/isp-catalog-form-screen"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function EditarServicioPage({ params }: PageProps) {
  const { id } = await params
  return <IspCatalogFormScreen catalogId={id} />
}
