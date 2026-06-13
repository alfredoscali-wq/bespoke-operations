import { ProjectDetailPageClient } from "@/components/obras/project-detail-page-client"

type ProjectDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const { id } = await params

  return <ProjectDetailPageClient id={id} />
}
