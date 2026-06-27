import {
  getResendApiKey,
  getWeeklyReportFromEmail,
} from "@/lib/reports/automatic/config"
import {
  buildWeeklyReportEmailHtmlBody,
  buildWeeklyReportEmailSubject,
  buildWeeklyReportEmailTextBody,
} from "@/lib/reports/automatic/mail/templates/weekly-report-email"

export type SendWeeklyReportEmailInput = {
  recipients: string[]
  weekNumber: number
  pdfBytes: Uint8Array
  pdfFileName: string
}

export type SendWeeklyReportEmailResult = {
  success: boolean
  message: string
  providerMessageId?: string
}

function encodePdfAttachment(pdfBytes: Uint8Array): string {
  return Buffer.from(pdfBytes).toString("base64")
}

export async function sendWeeklyReportEmail(
  input: SendWeeklyReportEmailInput
): Promise<SendWeeklyReportEmailResult> {
  if (input.recipients.length === 0) {
    return {
      success: false,
      message:
        "No hay destinatario configurado en Reportes Automáticos.",
    }
  }

  const apiKey = getResendApiKey()
  if (!apiKey) {
    return {
      success: false,
      message: "RESEND_API_KEY no está configurada.",
    }
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getWeeklyReportFromEmail(),
      to: input.recipients,
      subject: buildWeeklyReportEmailSubject(input.weekNumber),
      text: buildWeeklyReportEmailTextBody(),
      html: buildWeeklyReportEmailHtmlBody(),
      attachments: [
        {
          filename: input.pdfFileName,
          content: encodePdfAttachment(input.pdfBytes),
        },
      ],
    }),
  })

  const payload = (await response.json().catch(() => null)) as
    | { id?: string; message?: string; name?: string }
    | null

  if (!response.ok) {
    return {
      success: false,
      message:
        payload?.message ??
        `Resend respondió con estado ${response.status}.`,
    }
  }

  return {
    success: true,
    message: "Correo enviado correctamente.",
    providerMessageId: payload?.id,
  }
}
