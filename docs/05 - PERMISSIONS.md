# Permisos y Perfiles (BASELINE 1.0)

## Modelo de acceso

Bespoke Operations combina dos mecanismos:

1. **Perfil operativo** — derivado del `system_role` del usuario (sidebar y dashboard predeterminados).
2. **Roles de empresa** — roles personalizados con visibilidad por módulo (`APP_MODULE_KEYS`).

Si el usuario tiene un `roleId` de empresa, prevalece la visibilidad de módulos configurada. Si no, se usa el perfil operativo por defecto.

---

## Administrador

**Rol de sistema:** `administrador`

**Inicio:** Dashboard Operativo (`/`)

**Módulos Operaciones:**

- Dashboard, Calendario, Planificación, Obras, Órdenes de Trabajo, Archivo OT, Evidencias, Materiales, Clientes, Cuadrillas

**Otros:**

- Análisis (Reportes)
- RRHH completo
- Sistema: Configuración, Log, Usuarios, Dispositivos
- Administración: Mantenimiento

**Permisos destacados:**

- CRUD completo en todos los módulos
- Cierre y rechazo de OT
- Configuración de tipos de OT e incidencias
- Gestión de usuarios y roles de empresa
- Eliminación definitiva de OT (solo administrador de sistema)

---

## Supervisor

**Rol de sistema:** `supervisor`

**Inicio:** Calendario Operativo

**Módulos Operaciones:**

- Calendario, Planificación, Obras, Órdenes de Trabajo, Archivo OT, Clientes

**Otros:**

- Análisis (Reportes)
- Sistema: Configuración (limitada)

**Permisos destacados:**

- Planificación y confirmación de rutas
- Cierre y rechazo de OT pendientes de cierre
- Gestión de incidencias y replanificación
- Consulta de Archivo OT (solo lectura)
- Sin acceso a Mantenimiento, Usuarios ni Dispositivos

---

## Operario

**Rol de sistema:** `operario`

**Inicio:** Portal Operario (`/operario`)

**Acceso backoffice:** ninguno (redirigido al portal de campo)

**Permisos en Portal Operario:**

- Ver agenda del día de su cuadrilla
- Iniciar OT asignadas
- Completar checklist y pasos operativos
- Cargar evidencias y fotos
- Solicitar cierre e reportar incidencias
- Consultar perfil propio

**Field Agent (Android):** mismo rol operativo vía Mobile API con autenticación Bearer.

---

## Ventas

**Rol de sistema:** mapeado desde `administrativo` → perfil `ventas`

**Inicio:** Calendario Operativo

**Módulos Operaciones:**

- Calendario, Clientes, Órdenes de Trabajo, Archivo OT

**Otros:**

- Análisis (Reportes)

**Permisos destacados:**

- Crear y consultar OT comerciales (instalaciones, cambios)
- Gestión de clientes
- Sin planificación operativa ni cierre de OT de campo

---

## Demo

**Rol de sistema:** `demo`

**Inicio:** Dashboard Ejecutivo

**Módulos Operaciones:**

- Calendario, Órdenes de Trabajo, Archivo OT, Clientes, Obras

**Otros:**

- RRHH (consulta), Análisis, Log del Sistema

**Permisos destacados:**

- Modo **solo lectura** a nivel de base de datos (`auth_is_demo_platform_read_only()`)
- Recorrido comercial sin persistir cambios operativos
- Ideal para demostraciones comerciales

---

## Matriz resumida

| Capacidad | Admin | Supervisor | Operario | Ventas | Demo |
|-----------|:-----:|:----------:|:--------:|:------:|:----:|
| Planificación | ✓ | ✓ | — | — | — |
| Crear OT | ✓ | ✓ | — | ✓ | — |
| Ejecutar OT campo | — | — | ✓ | — | — |
| Cerrar OT | ✓ | ✓ | — | — | — |
| Archivo OT (lectura) | ✓ | ✓ | — | ✓ | ✓ |
| Clientes | ✓ | ✓ | — | ✓ | ✓ |
| Configuración | ✓ | parcial | — | — | — |
| Escritura en demo | ✓ | ✓ | ✓ | ✓ | — |

---

## Módulo Archivo OT

Comparte permiso con **Órdenes de Trabajo** (`work_orders`): usuarios con acceso a OT activas también ven Archivo OT en el menú. La ruta `/operations/archivo-ot` está incluida en `pathPrefixes` del módulo.
