"use client"

import { notFound } from "next/navigation"

import { ProjectDetailView } from "@/components/obras/project-detail-view"
import { useProjects } from "@/components/obras/projects-provider"

type ProjectDetailPageClientProps = {
  id: string
}

export function ProjectDetailPageClient({ id }: ProjectDetailPageClientProps) {
  const { getProject, getDetail } = useProjects()
  const project = getProject(id)
  const detail = getDetail(id)

  if (!project || !detail) {
    notFound()
  }

  return <ProjectDetailView project={project} detail={detail} />
}
