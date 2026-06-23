import type { EmployeeImportField } from "@/lib/employees/employee-import/types"
import type {
  EmployeeImportRowData,
} from "@/lib/employees/employee-import/types"

export const EMPLOYEE_IMPORT_TEMPLATE_HEADERS = [
  "DNI",
  "Nombre",
  "Apellido",
  "Nombre Preferido",
  "Email",
  "Teléfono",
  "Cargo",
  "Departamento",
  "Tipo Empleado",
  "Estado Laboral",
  "Fecha Ingreso",
  "Fecha Nacimiento",
  "Acceso Sistema",
  "Rol Sistema",
  "Observaciones",
] as const

const COLUMN_ALIASES: Record<EmployeeImportField, string[]> = {
  nationalId: ["dni", "national_id", "identificacion", "identificación"],
  firstName: ["nombre", "first_name", "first name"],
  lastName: ["apellido", "last_name", "last name"],
  preferredName: [
    "nombre preferido",
    "preferred_name",
    "preferred name",
    "nombre_preferido",
  ],
  email: ["email", "correo", "correo electronico", "correo electrónico"],
  phone: ["telefono", "teléfono", "phone", "celular"],
  jobTitle: ["cargo", "job_title", "puesto"],
  department: ["departamento", "department", "area", "área"],
  employeeType: [
    "tipo empleado",
    "tipo_empleado",
    "employee_type",
    "tipo",
  ],
  employmentStatus: [
    "estado laboral",
    "estado_laboral",
    "employment_status",
    "estado",
  ],
  hireDate: ["fecha ingreso", "fecha_ingreso", "hire_date", "ingreso"],
  birthDate: [
    "fecha nacimiento",
    "fecha_nacimiento",
    "birth_date",
    "nacimiento",
  ],
  systemAccess: [
    "acceso sistema",
    "acceso_sistema",
    "system_access",
    "acceso",
  ],
  systemRole: ["rol sistema", "rol_sistema", "system_role", "rol"],
  notes: ["observaciones", "notas", "notes"],
}

export function normalizeImportHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

const HEADER_TO_FIELD = new Map<string, EmployeeImportField>()

for (const header of EMPLOYEE_IMPORT_TEMPLATE_HEADERS) {
  HEADER_TO_FIELD.set(normalizeImportHeader(header), mapHeaderToField(header))
}

for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [
  EmployeeImportField,
  string[],
][]) {
  for (const alias of aliases) {
    HEADER_TO_FIELD.set(normalizeImportHeader(alias), field)
  }
}

function mapHeaderToField(header: string): EmployeeImportField {
  const map: Record<string, EmployeeImportField> = {
    DNI: "nationalId",
    Nombre: "firstName",
    Apellido: "lastName",
    "Nombre Preferido": "preferredName",
    Email: "email",
    Teléfono: "phone",
    Cargo: "jobTitle",
    Departamento: "department",
    "Tipo Empleado": "employeeType",
    "Estado Laboral": "employmentStatus",
    "Fecha Ingreso": "hireDate",
    "Fecha Nacimiento": "birthDate",
    "Acceso Sistema": "systemAccess",
    "Rol Sistema": "systemRole",
    Observaciones: "notes",
  }
  return map[header] ?? "notes"
}

export function mapImportHeaders(
  headers: string[]
): Partial<Record<number, EmployeeImportField>> {
  const mapping: Partial<Record<number, EmployeeImportField>> = {}

  headers.forEach((header, index) => {
    const field = HEADER_TO_FIELD.get(normalizeImportHeader(header))
    if (field) {
      mapping[index] = field
    }
  })

  return mapping
}

export function getEmptyImportRowData(): EmployeeImportRowData {
  return {
    nationalId: "",
    firstName: "",
    lastName: "",
    preferredName: "",
    email: "",
    phone: "",
    jobTitle: "",
    department: "",
    employeeType: "",
    employmentStatus: "",
    hireDate: "",
    birthDate: "",
    systemAccess: "",
    systemRole: "",
    notes: "",
  }
}
