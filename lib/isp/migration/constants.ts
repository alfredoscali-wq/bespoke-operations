export const ISP_MIGRATION_TEMPLATE_FILENAME =
  "Bespoke ISP - Plantilla de Migración v1.0.xlsx"

export const ISP_MIGRATION_TEMPLATE_DOWNLOAD_NAME =
  "Bespoke-ISP-Plantilla-Migracion-v1.0.xlsx"

export const ISP_MIGRATION_TEMPLATE_VERSION = "1.0"

export const ISP_MIGRATION_MAX_FILE_BYTES = 10 * 1024 * 1024

export const ISP_MIGRATION_HIDDEN_SECRET = "********"

export const ISP_MIGRATION_NO_REAL_DATA_MESSAGE =
  "No se encontraron datos reales para importar. Las filas de ejemplo de la plantilla fueron ignoradas."

export const ISP_MIGRATION_NO_REAL_DATA_REVIEW_TITLE =
  "No hay datos reales para revisar."

export const ISP_MIGRATION_NO_REAL_DATA_REVIEW_HINT =
  "Las filas de ejemplo de la plantilla fueron ignoradas."

export const ISP_MIGRATION_SHEETS = [
  "CLIENTES",
  "CATALOGO",
  "SERVICIOS",
  "CONEXIONES",
  "EQUIPAMIENTO",
  "INSTRUCCIONES",
] as const

export type IspMigrationSheetName = (typeof ISP_MIGRATION_SHEETS)[number]

export const ISP_MIGRATION_REQUIRED_SHEETS = [
  "CLIENTES",
  "CATALOGO",
  "SERVICIOS",
  "CONEXIONES",
] as const

export const ISP_MIGRATION_CUSTOMER_HEADERS = [
  "cliente_id_externo",
  "nombre_razon_social",
  "tipo_cliente",
  "dni_cuit",
  "telefono",
  "whatsapp",
  "email",
  "localidad",
  "domicilio",
  "observaciones",
  "estado_cliente",
] as const

export const ISP_MIGRATION_CATALOG_HEADERS = [
  "catalogo_id_externo",
  "nombre_servicio",
  "categoria",
  "tipo_cliente",
  "tecnologia",
  "velocidad_bajada",
  "velocidad_subida",
  "precio_mensual",
  "periodicidad",
  "medio_cobranza",
  "requiere_conexion",
  "tipos_conexion",
  "descripcion",
  "activo",
] as const

export const ISP_MIGRATION_SERVICE_HEADERS = [
  "servicio_id_externo",
  "cliente_id_externo",
  "catalogo_id_externo",
  "nombre_servicio",
  "tecnologia",
  "velocidad_bajada",
  "velocidad_subida",
  "precio_mensual",
  "fecha_alta",
  "estado_comercial",
  "medio_cobranza",
  "observaciones",
] as const

export const ISP_MIGRATION_SERVICE_NOT_FOUND_MESSAGE =
  "Servicio no encontrado en el catálogo de la empresa."

export function ispMigrationInvalidTvRefMessage(serviceName: string): string {
  const name = serviceName.trim() || "comercial"
  return `El servicio '${name}' referencia un plan TV inexistente o inválido.`
}

export const ISP_MIGRATION_CONNECTION_HEADERS = [
  "conexion_id_externo",
  "servicio_id_externo",
  "tipo_conexion",
  "estado_tecnico",
  "usuario_pppoe",
  "password_pppoe",
  "ip",
  "prefijo",
  "gateway",
  "vlan",
  "perfil_tecnico",
  "core",
  "fecha_provisionamiento",
  "observaciones",
] as const

export const ISP_MIGRATION_EQUIPMENT_HEADERS = [
  "equipamiento_id_externo",
  "conexion_id_externo",
  "tipo_equipo",
  "marca",
  "modelo",
  "numero_serie",
  "mac",
  "ip_gestion",
  "olt",
  "pon",
  "puerto",
  "torre",
  "sector",
  "cpe",
  "onu",
  "ont",
  "observaciones",
] as const

export const ISP_MIGRATION_SENSITIVE_FIELDS = ["password_pppoe"] as const
