import { NextResponse } from "next/server"

import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import { deleteTaskReferencePhotoFromAdmin } from "@/lib/tasks/task-reference-photo-delete.server"

type RouteContext = {
  params: Promise<{ taskId: string; photoId: string }>
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireWritablePlatformSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  const companyId = auth.sessionUser.companyId

  if (!companyId) {
    return NextResponse.json(
      {
        success: false,
        message: "No se pudo resolver la compania del usuario.",
      },
      { status: 403 }
    )
  }

  const { taskId, photoId } = await context.params

  const result = await deleteTaskReferencePhotoFromAdmin({
    companyId,
    taskId,
    photoId,
    sessionUser: auth.sessionUser,
  })

  if (!result.ok) {
    return NextResponse.json(
      { success: false, message: result.message, code: result.code },
      { status: result.status }
    )
  }

  return NextResponse.json({ success: true })
}
