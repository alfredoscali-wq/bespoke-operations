export const ISP_BILLING_VAT_CONDITIONS = [
  "responsable_inscripto",
  "monotributo",
  "exento",
  "consumidor_final",
] as const

export type IspBillingVatCondition =
  (typeof ISP_BILLING_VAT_CONDITIONS)[number]

export const ISP_BILLING_VAT_CONDITION_LABELS: Record<
  IspBillingVatCondition,
  string
> = {
  responsable_inscripto: "Responsable Inscripto",
  monotributo: "Monotributo",
  exento: "Exento",
  consumidor_final: "Consumidor Final",
}

export const ISP_BILLING_DOCUMENT_TYPES = [
  "factura_a",
  "factura_b",
  "factura_c",
  "comprobante_x",
  "presupuesto",
  "nota_credito",
  "nota_debito",
] as const

export type IspBillingDocumentType =
  (typeof ISP_BILLING_DOCUMENT_TYPES)[number]

export const ISP_BILLING_DOCUMENT_TYPE_LABELS: Record<
  IspBillingDocumentType,
  string
> = {
  factura_a: "Factura A",
  factura_b: "Factura B",
  factura_c: "Factura C",
  comprobante_x: "Comprobante X",
  presupuesto: "Presupuesto",
  nota_credito: "Nota de crédito",
  nota_debito: "Nota de débito",
}

export const ISP_BILLING_NON_FISCAL_DOCUMENT_TYPES = [
  "comprobante_x",
  "presupuesto",
] as const

export const ISP_BILLING_INTEGRATION_PROVIDERS = ["arca", "siro"] as const
export type IspBillingIntegrationProvider =
  (typeof ISP_BILLING_INTEGRATION_PROVIDERS)[number]

export const ISP_BILLING_INTEGRATION_STATUSES = [
  "not_configured",
  "pending",
  "connected",
  "error",
] as const

export type IspBillingIntegrationStatus =
  (typeof ISP_BILLING_INTEGRATION_STATUSES)[number]

export const ISP_BILLING_INTEGRATION_ENVIRONMENTS = [
  "testing",
  "production",
] as const

export type IspBillingIntegrationEnvironment =
  (typeof ISP_BILLING_INTEGRATION_ENVIRONMENTS)[number]

export const ISP_BILLING_POS_STATUSES = ["active", "inactive"] as const
export type IspBillingPosStatus = (typeof ISP_BILLING_POS_STATUSES)[number]

export const ARGENTINA_PROVINCES = [
  "Ciudad Autónoma de Buenos Aires",
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
] as const

export const ISP_BILLING_LOGO_BUCKET = "isp-billing-logos"
export const ISP_BILLING_LOGO_MAX_BYTES = 2 * 1024 * 1024
export const ISP_BILLING_LOGO_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const

export const ISP_BILLING_SAVED_MESSAGE =
  "Configuración guardada correctamente"
export const ISP_BILLING_CUIT_REQUIRED_MESSAGE = "Falta CUIT"
export const ISP_BILLING_CUIT_INVALID_MESSAGE = "El CUIT no es válido."
export const ISP_BILLING_LEGAL_NAME_REQUIRED_MESSAGE = "Falta razón social"
export const ISP_BILLING_VAT_REQUIRED_MESSAGE = "Falta condición frente al IVA"
export const ISP_BILLING_ADDRESS_REQUIRED_MESSAGE = "Falta domicilio fiscal"
export const ISP_BILLING_POS_REQUIRED_MESSAGE = "Falta punto de venta"
export const ISP_BILLING_POS_NUMBER_INVALID_MESSAGE =
  "El número de punto de venta debe ser numérico."
export const ISP_BILLING_POS_DUPLICATE_MESSAGE =
  "Ya existe un punto de venta con ese número."
export const ISP_BILLING_POS_INVALID_ACTIVE_MESSAGE =
  "No se puede activar un punto de venta inválido."
export const ISP_BILLING_SEQUENCE_LOCKED_MESSAGE =
  "La numeración no se puede modificar porque ya existen comprobantes emitidos."
export const ISP_BILLING_CROSS_COMPANY_MESSAGE =
  "No se puede consultar ni modificar la configuración fiscal de otra empresa."
export const ISP_BILLING_FORBIDDEN_MESSAGE =
  "No tiene permiso para modificar la configuración fiscal."
export const ISP_BILLING_ARCA_PENDING_LABEL = "ARCA pendiente"
export const ISP_BILLING_SIRO_PENDING_LABEL = "SIRO pendiente"
export const ISP_BILLING_ARCA_NOT_CONFIGURED_LABEL = "No configurado"
export const ISP_BILLING_SIRO_NOT_CONFIGURED_LABEL = "No configurado"
export const ISP_BILLING_COMPANY_READY_LABEL = "Empresa configurada"
export const ISP_BILLING_POS_READY_LABEL = "Punto de venta configurado"
export const ISP_BILLING_INCOMPLETE_LABEL = "Configuración incompleta"
export const ISP_BILLING_SIRO_HELP =
  "SIRO se configurará posteriormente para enviar la información de facturación y recibir información de pagos."
export const ISP_BILLING_ARCA_HELP =
  "ARCA se configurará posteriormente. En esta etapa no se solicitan certificados ni se emite CAE."
export const ISP_BILLING_DOCUMENTS_TITLE = "Comprobantes"
export const ISP_BILLING_DOCUMENTS_SUBTITLE =
  "Gestioná facturas, presupuestos y demás documentos emitidos."
export const ISP_BILLING_DOCUMENTS_EMPTY_TITLE = "Todavía no hay comprobantes"
export const ISP_BILLING_DOCUMENTS_EMPTY_DESCRIPTION =
  "Cuando generes una factura, presupuesto u otro documento aparecerá aquí."
export const ISP_BILLING_DOCUMENT_CUSTOMER_REQUIRED =
  "El cliente o abonado es obligatorio."
export const ISP_BILLING_DOCUMENT_TYPE_INVALID =
  "El tipo de comprobante no es válido."
export const ISP_BILLING_DOCUMENT_ITEMS_REQUIRED =
  "El comprobante debe tener al menos un concepto."
export const ISP_BILLING_DOCUMENT_ITEM_DESCRIPTION_REQUIRED =
  "Cada concepto necesita una descripción."
export const ISP_BILLING_DOCUMENT_ISSUER_REQUIRED =
  "Falta la empresa facturadora. Completá Sistema → Configuración → Facturación."
export const ISP_BILLING_DOCUMENT_POS_REQUIRED = "Falta el punto de venta."
export const ISP_BILLING_DOCUMENT_DRAFT_ONLY =
  "Solo se puede editar un comprobante en borrador."
export const ISP_BILLING_DOCUMENT_ISSUED_LOCKED =
  "Un comprobante emitido no se puede modificar."
export const ISP_BILLING_DOCUMENT_CANCELLED =
  "El comprobante ya está anulado."
export const ISP_BILLING_DOCUMENT_NOT_FOUND = "Comprobante no encontrado."
export const ISP_BILLING_DOCUMENT_SAVED = "Comprobante guardado como borrador."
export const ISP_BILLING_DOCUMENT_ISSUED = "Comprobante emitido."
export const ISP_BILLING_DOCUMENT_CANCEL_CONFIRM =
  "¿Querés anular este comprobante?"
export const ISP_BILLING_DOCUMENT_CANCELLED_MESSAGE =
  "El comprobante fue anulado."
export const ISP_BILLING_DOCUMENT_NON_FISCAL_NOTICE =
  "DOCUMENTO NO VÁLIDO COMO FACTURA"
export const ISP_BILLING_DOCUMENT_ARCA_PENDING =
  "Pendiente de integración ARCA"
export const ISP_BILLING_DOCUMENT_ISSUED_PENDING_LABEL =
  "Emitido — pendiente de autorización fiscal"
export const ISP_BILLING_DOCUMENT_FORBIDDEN =
  "No tiene permiso para trabajar con comprobantes."
export const ISP_BILLING_NO_EMISSION_HELP =
  "La emisión de comprobantes se hace desde Administración → Facturación → Comprobantes."
export const ISP_BILLING_MONTHLY_TITLE = "Facturación mensual"
export const ISP_BILLING_MONTHLY_SUBTITLE =
  "Prepará, revisá y confirmá el ciclo mensual antes de emitir comprobantes."
export const ISP_BILLING_MONTHLY_EMPTY_TITLE =
  "No hay una preparación de facturación para este período."
export const ISP_BILLING_MONTHLY_PERIOD_BILLED =
  "Este período ya fue facturado."
export const ISP_BILLING_MONTHLY_CONFIRM_BLOCKED =
  "Hay errores bloqueantes. Corregilos en el origen y volvé a preparar."
export const ISP_BILLING_MONTHLY_CANCELLED =
  "La preparación fue cancelada. No se emitieron comprobantes."
export const ISP_BILLING_MONTHLY_CONFIRMED =
  "La facturación del período fue confirmada y se emitieron los comprobantes."
export const ISP_BILLING_MONTHLY_PREPARED =
  "Preparación lista para revisar. Todavía no se emitió ningún comprobante."
export const ISP_BILLING_RUN_MISSING_FISCAL =
  "El cliente no tiene los datos fiscales necesarios."
export const ISP_BILLING_RUN_MISSING_PRICE =
  "El servicio no tiene precio contratado."
export const ISP_BILLING_RUN_INCONSISTENT =
  "El servicio está inconsistente para facturar."
export const ISP_BILLING_RUN_TYPE_UNDETERMINED =
  "No se pudo determinar el tipo de comprobante."
export const ISP_BILLING_RUN_ISSUER_INCOMPLETE =
  "La configuración fiscal está incompleta."
export const ISP_BILLING_RUN_POS_MISSING = "Falta el punto de venta."
export const ISP_BILLING_RUN_CANCELLED_REVIEW =
  "Servicio dado de baja: el prorrateo de baja todavía no está definido."
