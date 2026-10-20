import { NextResponse } from "next/server"

import { clients360PadronNumberFromId } from "@/lib/isp/clients-360-directory"
import { removeClients360PadronRecord } from "@/lib/isp/clients-360-record-actions"
import { requireIspSubscriberRemovalContext } from "@/lib/isp/route-context"
import { removeIspSubscriberMembership } from "@/lib/isp/subscriber-removal-queries"
import {
  ISP_SUBSCRIBER_REMOVED_MESSAGE,
  ISP_SUBSCRIBER_REMOVAL_ERROR_MESSAGE,
  isIspSubscriberRemovalConfirmation,
  ispSubscriberRemovalUserMessage,
} from "@/lib/isp/subscriber-removal"
import { createClient } from "@/lib/supabase/server"

type RouteContext = { params: Promise<{ id: string }> }

type RemovalBody = {
  confirmation?: string
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireIspSubscriberRemovalContext()
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const padronNumber = clients360PadronNumberFromId(id)

  let body: RemovalBody = {}
  try {
    const text = await request.text()
    if (text.trim()) {
      body = JSON.parse(text) as RemovalBody
    }
  } catch {
    return NextResponse.json(
      { success: false, message: ISP_SUBSCRIBER_REMOVAL_ERROR_MESSAGE },
      { status: 400 }
    )
  }

  if (!isIspSubscriberRemovalConfirmation(body.confirmation ?? "")) {
    return NextResponse.json(
      { success: false, message: ISP_SUBSCRIBER_REMOVAL_ERROR_MESSAGE },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    if (padronNumber) {
      const removed = await removeClients360PadronRecord(
        client,
        auth.companyId,
        padronNumber
      )
      if (!removed.ok) {
        return NextResponse.json(
          { success: false, message: removed.message },
          { status: 409 }
        )
      }
      return NextResponse.json({
        success: true,
        alreadyRemoved: false,
        message: ISP_SUBSCRIBER_REMOVED_MESSAGE,
      })
    }
    const result = await removeIspSubscriberMembership(client, id)
    return NextResponse.json({
      success: true,
      alreadyRemoved: result.alreadyRemoved,
      message: ISP_SUBSCRIBER_REMOVED_MESSAGE,
    })
  } catch (error) {
    const mapped = ispSubscriberRemovalUserMessage(error)
    return NextResponse.json(
      {
        success: false,
        message: mapped.message,
        alreadyRemoved: mapped.alreadyRemoved === true,
      },
      { status: mapped.status }
    )
  }
}
