import {
  buildCaseClosedActivity,
  buildCaseCreatedActivity,
} from "@/lib/customer-atenciones/customer-activity-events"
import {
  buildNewConsultationCreationFields,
  validateNewConsultationInput,
} from "@/lib/customer-atenciones/consultation"
import { requestRegisterCustomerActivity } from "@/lib/customer-atenciones/register-customer-activity.client"
import { createCustomerAtencion } from "@/lib/supabase/customer-atenciones.browser"
import type { NewCustomerAtencionInput } from "@/lib/types/customer-atenciones"

export async function submitIspCustomerAtencion(input: {
  companyId: string
  employeeId: string
  payload: NewCustomerAtencionInput
}): Promise<{ success: boolean; message?: string }> {
  const validationError = validateNewConsultationInput(input.payload)
  if (validationError) {
    return { success: false, message: validationError }
  }

  const creation = buildNewConsultationCreationFields(input.payload)
  if ("error" in creation) {
    return { success: false, message: creation.error }
  }

  const customerId = input.payload.customerId?.trim() ?? ""
  if (!customerId) {
    return { success: false, message: "Selecciona un cliente." }
  }

  const result = await createCustomerAtencion({
    companyId: input.companyId,
    customerId,
    attendedByEmployeeId: input.employeeId,
    channel: input.payload.channel,
    motivo: input.payload.motivo,
    detail: input.payload.detail,
    resolution: creation.resolution,
    resultado: creation.resultado,
    status: creation.status,
    nextStep: creation.nextStep,
  })

  if (result.error || !result.data) {
    return {
      success: false,
      message: result.error?.message ?? "No se pudo registrar la atención.",
    }
  }

  const atencion = result.data
  void requestRegisterCustomerActivity({
    entityId: atencion.id,
    ...buildCaseCreatedActivity({
      customerId: atencion.customerId,
      motivo: atencion.motivo,
      canal: atencion.channel,
      estadoInicial: atencion.status,
      nextStep: atencion.nextStep ?? null,
    }),
  })

  if (atencion.status === "resuelta") {
    void requestRegisterCustomerActivity({
      entityId: atencion.id,
      ...buildCaseClosedActivity({
        resultado: atencion.resultado,
        motivoCierre: atencion.resolution || null,
      }),
    })
  }

  return { success: true }
}
