import { ProjectDesignPageClient } from "@/components/obras/design/project-design-page-client"

type ProjectDesignPageProps = {
  params: Promise<{ id: string }>
}

export default async function ProjectDesignPage({
  params,
}: ProjectDesignPageProps) {
  const { id } = await params
  return <ProjectDesignPageClient projectId={id} />
}
