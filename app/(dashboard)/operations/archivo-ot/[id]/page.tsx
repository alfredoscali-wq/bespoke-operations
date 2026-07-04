import { TaskDetailPageClient } from "@/components/tareas/task-detail-page-client"

type ArchivoOtDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function ArchivoOtDetailPage({
  params,
}: ArchivoOtDetailPageProps) {
  const { id } = await params

  return (
    <TaskDetailPageClient
      id={id}
      backHref="/operations/archivo-ot"
      requireArchived
    />
  )
}
