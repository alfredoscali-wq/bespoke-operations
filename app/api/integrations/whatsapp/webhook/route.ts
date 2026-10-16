import { NextResponse } from "next/server"

import { readWhatsappSendConfig } from "@/lib/integrations/whatsapp/graph-client"
import {
  readWhatsappInboundMessages,
  resolveWhatsappBusinessCompany,
  verifyMetaWebhookSignature,
  verifyWhatsappWebhookToken,
} from "@/lib/integrations/whatsapp/webhook-guard"
import { handleWhatsappInboundMessage } from "@/lib/subscriptions/whatsapp-commercial-session"

export const dynamic = "force-dynamic"

function configuredWebhook() {
  return {
    appSecret: process.env.WHATSAPP_APP_SECRET?.trim() ?? "",
    verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() ?? "",
    phoneNumberId: process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID?.trim() ?? "",
    companyId: process.env.WHATSAPP_BUSINESS_COMPANY_ID?.trim() ?? "",
  }
}

export async function GET(request: Request) {
  const config = configuredWebhook()
  const url = new URL(request.url)
  const mode = url.searchParams.get("hub.mode")
  const token = url.searchParams.get("hub.verify_token")
  const challenge = url.searchParams.get("hub.challenge")
  if (
    mode !== "subscribe" ||
    !challenge ||
    !verifyWhatsappWebhookToken({
      providedToken: token,
      configuredToken: config.verifyToken,
    })
  ) {
    return NextResponse.json({ success: false, message: "Verificación rechazada." }, { status: 403 })
  }
  return new NextResponse(challenge, { status: 200 })
}

export async function POST(request: Request) {
  const config = configuredWebhook()
  if (!config.appSecret || !config.phoneNumberId || !config.companyId || !readWhatsappSendConfig(process.env)) {
    return NextResponse.json(
      { success: false, message: "WhatsApp comercial no está configurado." },
      { status: 503 }
    )
  }

  const rawBody = await request.text()
  const signature = request.headers.get("x-hub-signature-256")
  if (
    !verifyMetaWebhookSignature({
      rawBody,
      signatureHeader: signature,
      appSecret: config.appSecret,
    })
  ) {
    return NextResponse.json({ success: false, message: "Firma inválida." }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody) as unknown
  } catch {
    return NextResponse.json({ success: false, message: "Aviso inválido." }, { status: 400 })
  }

  const parsed = readWhatsappInboundMessages(body)
  if (!parsed.ok) {
    if (parsed.reason === "ignored") {
      return NextResponse.json({ success: true, received: 0 })
    }
    return NextResponse.json({ success: false, message: "Número comercial no resuelto." }, { status: 403 })
  }
  const company = resolveWhatsappBusinessCompany({
    configuredPhoneNumberId: config.phoneNumberId,
    configuredCompanyId: config.companyId,
    payloadPhoneNumberId: parsed.phoneNumberId,
  })
  if (!company.ok) {
    return NextResponse.json({ success: false, message: "Número comercial no autorizado." }, { status: 403 })
  }

  let registered = 0
  let confirmed = 0
  for (const message of parsed.messages) {
    const handled = await handleWhatsappInboundMessage({
      companyId: company.companyId,
      message,
    })
    if (handled.retry) {
      return NextResponse.json(
        { success: false, message: "WhatsApp no confirmó el envío." },
        { status: 500 }
      )
    }
    if (handled.registered) registered += 1
    if (handled.outboundConfirmed) confirmed += 1
  }

  return NextResponse.json({
    success: true,
    received: parsed.messages.length,
    registered,
    outboundConfirmed: confirmed,
  })
}
