import { NextResponse } from "next/server"

import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import {
  deleteWorkOrderFromAdmin,
  updateWorkOrderFromAdmin,
  WorkOrderAdminMutationError,
} from "@/lib/tasks/work-order-admin-mutation.server"
import { createClient } from "@/lib/supabase/server"
import type { UpdateTaskPayload } from "@/lib/types/supabase/tasks"

type RouteContext = {
  params: Promise<{ taskId: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireWritablePlatformSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  const { taskId } = await context.params

  let payload: UpdateTaskPayload
  try {
    payload = (await request.json()) as UpdateTaskPayload
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    const task = await updateWorkOrderFromAdmin(
      client,
      taskId,
      payload,
      auth.sessionUser
    )

    return NextResponse.json({ success: true, task })
  } catch (error) {
    if (error instanceof WorkOrderAdminMutationError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.httpStatus }
      )
    }

    const message =
      error instanceof Error
        ? error.message
        : "No fue posible actualizar la orden de trabajo."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireWritablePlatformSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  const { taskId } = await context.params

  try {
    const client = await createClient()
    await deleteWorkOrderFromAdmin(client, taskId, auth.sessionUser)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof WorkOrderAdminMutationError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.httpStatus }
      )
    }

    const message =
      error instanceof Error
        ? error.message
        : "No fue posible eliminar la orden de trabajo."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
