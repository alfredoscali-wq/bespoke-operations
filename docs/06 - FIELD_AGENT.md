# Field Agent y Portal Operario (BASELINE 1.0)

## Contexto

Bespoke Operations expone **dos superficies de ejecución de campo**:

| Superficie | Usuarios | Tecnología |
|------------|----------|------------|
| **Portal Operario** | Operarios | PWA en navegador (`/operario`) |
| **Bespoke Field Agent** | Operarios | App Android nativa |

Ambas consumen la misma lógica de dominio. Field Agent usa la **Mobile API** (`/api/mobile/v1/`) con autenticación Bearer; el Portal Operario usa sesión cookie dentro de la misma app Next.js.

---

## Field Agent — Flujo operativo

### Login

`POST /api/mobile/v1/auth/login`

- Credenciales: email o DNI + contraseña (mismas reglas que backoffice)
- Requiere `deviceId`, `appVersion`, `platform: android`
- Retorna `accessToken`, `refreshToken` y perfil mínimo del operario
- Valida empleado activo y acceso de campo

### Jornada

| Endpoint | Acción |
|----------|--------|
| `POST /api/mobile/v1/shifts/start` | Iniciar jornada / turno de cuadrilla |
| `GET /api/mobile/v1/shifts/current` | Consultar jornada activa |
| `POST /api/mobile/v1/shifts/finish` | Finalizar jornada |

La jornada vincula al operario con su cuadrilla del día (`work_team_shifts`).

### Agenda

`GET /api/mobile/v1/agenda/today`

- OT del día para la cuadrilla del operario
- Ordenadas por `dispatch_order`
- Solo OT asignadas y en estados ejecutables

### Inicio de OT

`POST /api/mobile/v1/tasks/[taskId]/start`

- Transición **Asignada → En Curso**
- Requiere jornada activa y pertenencia a la cuadrilla
- OT vencida no puede iniciarse (debe replanificarse)

### Checklist

| Endpoint | Acción |
|----------|--------|
| `GET /api/mobile/v1/tasks/[taskId]` | Detalle de OT |
| `POST .../checklist-responses` | Registrar respuestas |
| `POST .../checklist-photos` | Subir fotos por paso |

El checklist operativo se define por **tipo de OT** configurado en backoffice.

### Evidencias

Las evidencias de checklist se cargan vía endpoints de fotos por paso. El registro formal en módulo Evidencias del backoffice es independiente pero comparte storage.

### GPS

- Coordenadas de OT almacenadas en campos `latitude`, `longitude`, `shared_location`
- Resolución de ubicación vía `/api/operations/location/resolve`
- **No hay tracking GPS en tiempo real** (ver limitaciones)

### Finalización

`POST /api/mobile/v1/tasks/[taskId]/submit-for-approval`

- Transición **En Curso → Pendiente de Cierre**
- Valida checklist operativo completo según plantilla del tipo de OT
- El supervisor aprueba desde backoffice → **Finalizada**

### Incidencias

| Endpoint | Acción |
|----------|--------|
| `GET .../incident-types` | Tipos configurados |
| `POST .../incidents` | Reportar incidencia → estado Incidencia |

---

## Portal Operario — Flujo equivalente

Ruta base: `/operario`

| Función | Implementación |
|---------|----------------|
| Login | Sesión cookie Supabase (mismo auth que backoffice) |
| Agenda | `/operario` — OT del día filtradas por cuadrilla del operario |
| Detalle OT | `/operario/tarea/[id]` |
| Inicio | Botón “Iniciar” en footer de detalle |
| Checklist / pasos | UI integrada con `TasksProvider` |
| Evidencias | Conteo de fotos por paso o evidencias legacy |
| Cierre | “Solicitar cierre” con validación `validateTaskClosureForSubmit` |
| Incidencias | Diálogo de reporte de incidencia |

---

## Diferencias intencionales respecto al Portal Operario

| Aspecto | Field Agent | Portal Operario |
|---------|-------------|-----------------|
| Autenticación | Bearer token (Mobile API) | Cookie session |
| Dispositivo | Registro obligatorio (`deviceId`) | Navegador, sin provisioning |
| Jornada | Turno explícito start/finish | Implícito (cuadrilla del operario) |
| Validación de cierre | Checklist operativo por plantilla de tipo OT | Checklist legacy + pasos operativos + conteo de evidencias |
| Offline | Preparado para cliente nativo | Requiere conexión |
| Auditoría | Eventos mobile con `workTeamId` y `mobileDeviceId` | Eventos web estándar |

Estas diferencias son **intencionales en BASELINE 1.0**. La paridad completa de validación submit Web/Mobile está documentada como limitación conocida.

---

## Dispositivos corporativos

El módulo **Dispositivos** (`/dispositivos`) administra equipos autorizados para Field Agent. El provisioning se realiza vía `POST /api/mobile/v1/devices/provision`.

---

## Documentación técnica Mobile API

Contratos detallados, códigos de error y envelopes de respuesta: [mobile-api.md](./mobile-api.md)
