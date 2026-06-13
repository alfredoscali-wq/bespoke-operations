import { TaskDetailPageClient } from "@/components/tareas/task-detail-page-client"

type TaskDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { id } = await params

  return <TaskDetailPageClient id={id} />
}
