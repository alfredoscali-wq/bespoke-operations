import { DEMO_CORDOBA_ZONES } from "@/lib/demo/commercial-dataset"
import type { OperationalChecklistTemplateItem } from "@/lib/tasks/operational-checklist-template"
import type { WorkOrderServiceType } from "@/lib/tasks/work-order"

function item(
  id: string,
  title: string,
  fieldType: OperationalChecklistTemplateItem["fieldType"],
  sortOrder: number
): OperationalChecklistTemplateItem {
  return {
    id,
    title,
    fieldType,
    required: true,
    sortOrder,
  }
}

export const DEMO_MOBILE_TASK_DEFINITIONS = [
  {
    code: "DEMO-MOBILE-001" as const,
    title: "Instalación de ONU",
    description:
      "OT lista para demostración en vivo: instalación de ONU en domicilio del cliente.",
    latitude: DEMO_CORDOBA_ZONES.nuevaCordoba.latitude,
    longitude: DEMO_CORDOBA_ZONES.nuevaCordoba.longitude,
    serviceAddress: "Bv. Chacabuco 850, Nueva Córdoba, Córdoba",
    locality: DEMO_CORDOBA_ZONES.nuevaCordoba.name,
    customerCode: "DEMO-SEED-0001",
    serviceType: "instalacion-nueva" as WorkOrderServiceType,
    checklist: [
      item(
        "demo-mobile-001-verificar-instalacion",
        "Verificar domicilio",
        "confirmacion",
        1
      ),
      item("demo-mobile-001-verificar-equipo", "Verificar equipo", "confirmacion", 2),
      item("demo-mobile-001-conectar-equipo", "Cableado realizado", "confirmacion", 3),
      item(
        "demo-mobile-001-registrar-observacion",
        "Prueba de servicio",
        "entrada-datos",
        4
      ),
      item("demo-mobile-001-tomar-fotografia", "Tomar fotografía", "fotografia", 5),
    ],
  },
  {
    code: "DEMO-MOBILE-002" as const,
    title: "Reparación de fibra",
    description: "OT de demostración Mobile: reparación de enlace de fibra.",
    latitude: DEMO_CORDOBA_ZONES.alberdi.latitude,
    longitude: DEMO_CORDOBA_ZONES.alberdi.longitude,
    serviceAddress: "Av. Colón 1850, Alberdi, Córdoba",
    locality: DEMO_CORDOBA_ZONES.alberdi.name,
    customerCode: "DEMO-SEED-0003",
    serviceType: "service-tecnico" as WorkOrderServiceType,
    checklist: [
      item("demo-mobile-002-verificar-falla", "Revisar equipo", "confirmacion", 1),
      item(
        "demo-mobile-002-revisar-conexion",
        "Revisar conectores",
        "confirmacion",
        2
      ),
      item(
        "demo-mobile-002-realizar-reparacion",
        "Verificar señal",
        "confirmacion",
        3
      ),
      item(
        "demo-mobile-002-verificar-servicio",
        "Observaciones",
        "entrada-datos",
        4
      ),
      item("demo-mobile-002-tomar-fotografia", "Tomar fotografía", "fotografia", 5),
    ],
  },
  {
    code: "DEMO-MOBILE-003" as const,
    title: "Mantenimiento de red",
    description: "OT de demostración Mobile: mantenimiento de red de acceso.",
    latitude: DEMO_CORDOBA_ZONES.generalPaz.latitude,
    longitude: DEMO_CORDOBA_ZONES.generalPaz.longitude,
    serviceAddress: "Av. 24 de Septiembre 640, General Paz, Córdoba",
    locality: DEMO_CORDOBA_ZONES.generalPaz.name,
    customerCode: "DEMO-SEED-0004",
    serviceType: "service-tecnico" as WorkOrderServiceType,
    checklist: [
      item(
        "demo-mobile-003-revisar-instalacion",
        "Revisar equipo",
        "confirmacion",
        1
      ),
      item(
        "demo-mobile-003-verificar-conexiones",
        "Revisar alimentación",
        "confirmacion",
        2
      ),
      item(
        "demo-mobile-003-registrar-estado",
        "Observaciones",
        "entrada-datos",
        3
      ),
      item("demo-mobile-003-tomar-fotografia", "Tomar fotografía", "fotografia", 4),
    ],
  },
] as const
