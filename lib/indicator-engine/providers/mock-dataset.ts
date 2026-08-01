import type { ActivityEngineSourceEventV1 } from "@/lib/indicator-engine/adapters/activity-source"

const DAY = "2026-08-01"
const EMP_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const EMP_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

/**
 * Small representative in-memory dataset for E2E pipeline validation.
 * Simulated shapes only — not from activity_events / Supabase.
 */
export const DEMO_ACTIVITY_DATASET: readonly ActivityEngineSourceEventV1[] = [
  {
    id: "demo-att-created",
    module: "atencion",
    action: "attention.created",
    entityType: "customer_atencion",
    entityId: "att-100",
    employeeId: EMP_A,
    createdAt: `${DAY}T09:00:00.000Z`,
    title: "Consulta abierta",
    description: "Cliente reporta falla de servicio",
    metadata: {},
    severity: "INFO",
    origin: "web",
  },
  {
    id: "demo-att-pending",
    module: "atencion",
    action: "attention.created",
    entityType: "customer_atencion",
    entityId: "att-101",
    employeeId: EMP_B,
    createdAt: `${DAY}T09:30:00.000Z`,
    title: "Consulta pendiente",
    description: "Sin resolución en el día",
    metadata: {},
  },
  {
    id: "demo-att-resolved",
    module: "atencion",
    action: "attention.resolved",
    entityType: "customer_atencion",
    entityId: "att-100",
    employeeId: EMP_A,
    createdAt: `${DAY}T11:00:00.000Z`,
    title: "Consulta resuelta",
    description: "Problema solucionado",
    metadata: {},
  },
  {
    id: "demo-att-transfer",
    module: "atencion",
    action: "attention.transferred",
    entityType: "customer_atencion",
    entityId: "att-102",
    employeeId: EMP_A,
    createdAt: `${DAY}T10:15:00.000Z`,
    title: "Derivación",
    description: "Derivada a retención",
    metadata: {},
  },
  {
    id: "demo-wo-created",
    module: "tasks",
    action: "workorder.created",
    entityType: "task",
    entityId: "task-200",
    employeeId: EMP_B,
    createdAt: `${DAY}T10:00:00.000Z`,
    title: "OT creada",
    description: "Instalación programada",
    metadata: {},
  },
  {
    id: "demo-wo-finished",
    module: "tasks",
    action: "workorder.finished",
    entityType: "task",
    entityId: "task-200",
    employeeId: EMP_B,
    createdAt: `${DAY}T16:00:00.000Z`,
    title: "OT finalizada",
    description: "Trabajo completado",
    metadata: {},
  },
  {
    id: "demo-customer-new",
    module: "customers",
    action: "customer.created",
    entityType: "customer",
    entityId: "cust-300",
    employeeId: EMP_A,
    createdAt: `${DAY}T08:45:00.000Z`,
    title: "Cliente nuevo",
    description: "Alta comercial",
    metadata: {},
  },
  {
    id: "demo-sale",
    module: "commercial",
    action: "commercial_activity.completed",
    entityType: "sales_opportunity",
    entityId: "opp-400",
    employeeId: EMP_A,
    createdAt: `${DAY}T12:30:00.000Z`,
    title: "Venta registrada",
    description: "Oportunidad cerrada",
    metadata: {},
  },
  {
    id: "demo-retention",
    module: "customer_service",
    action: "NEXT_STEP_CHANGED",
    entityType: "customer_atencion",
    entityId: "att-102",
    employeeId: EMP_A,
    createdAt: `${DAY}T10:20:00.000Z`,
    title: "Retención realizada",
    detail: "Próximo paso → retención",
    metadata: {
      new_next_step: "realizar_retencion",
      previous_next_step: "seguimiento",
      rpc_debug: "drop-me",
    },
    actorType: "employee",
    sessionId: "sess-should-drop",
  },
]

export const DEMO_EMPLOYEE_A_ID = EMP_A
export const DEMO_EMPLOYEE_B_ID = EMP_B
export const DEMO_BUSINESS_DATE = DAY
