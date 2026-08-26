# OT 1.4 — Integridad cliente → OT

Fecha: 2026-08-26.

- **1.4:** auditoría (causa raíz confirmada).
- **1.4.1:** corrección implementada. El save reutiliza `form.customerId` cuando existe.

## 1.4.1 — Solución implementada

Regla:

```
SI form.customerId es no vacío:
    reutilizarlo. NO createCustomer.

SI no hay customerId y el tipo es instalación nueva:
    crear ficha (comportamiento anterior).
```

La prioridad vive en `planWorkOrderCustomerResolution` (`lib/tasks/work-order-customer-resolve.ts`), usada por el diálogo y el import.

`pendiente-activacion` sigue en `customers.status` (ficha, no servicio ni OT). Solo se aplica al aprobar una instalación nueva. Si la OT **reutilizó** un cliente ya `activo`, **no** se degrada el estado. Las altas reales (sin customerId, ficha creada en el save) siguen pasando a `pendiente-activacion`.

La reutilización se marca en `task.taskMetadata.reusedExistingCustomer = true` solo en **create**, cuando `form.customerId` ya coincidía con el id resuelto. La edición **preserva** el flag original y no lo infiere (un cliente recién creado no debe parecer reutilizado al editar).

### Archivos modificados (1.4.1)

- `lib/tasks/work-order-customer-resolve.ts` (nuevo)
- `components/tareas/task-work-order-dialog.tsx`
- `lib/tasks/work-order.ts`
- `lib/tasks/work-order-approval-effects.ts`
- `lib/tasks/work-order-customer-prefill.ts`
- `lib/tasks/work-order-import/execute.ts`
- `lib/tasks/work-order-import/validate.ts`
- `lib/commercial/solicitud-ot-create.ts`
- `components/gestion-comercial/commercial-dossier-module.tsx`
- `scripts/test-ot-1-4-1-customer-reuse.mjs` (nuevo)
- `scripts/test-ot-1-4-customer-integrity.mjs` (actualizado)
- `package.json` (`test:ot-1-4-1-customer-reuse`)

No se tocó RPC OT 1.1, migraciones, OT 1.2, OT 1.3, Planning ni Facturación.

### Comportamiento por origen

**Atención:** `atencion.customer_id = C1` → form C1 → OT `customer_id = C1`. El link de consulta no reescribe `customer_id`. Atención y OT quedan en el mismo cliente.

**Nueva OT:** seleccionar C1 y pasar a instalación nueva → se reutiliza C1. Instalación nueva en blanco (sin id) → se crea ficha.

**Comercial:** solo se copia `opportunity.sourceCustomerId` si viene informado (uuid de `customers`, origen Atención). No hay matching por nombre/teléfono/DNI/CUIT. Lead sin ese id: se sigue creando ficha al guardar.

**Import:** si el CSV trae `customer_id` / `id_cliente`, se reutiliza. Si no, instalación nueva sigue creando. No se agregó matching heurístico en instalación nueva. Los otros tipos siguen resolviendo por nombre/teléfono cuando no hay id explícito.

### `pendiente-activacion`

Dónde: `buildInstalacionNuevaUpdate` → `customers.status`, al **aprobar** la OT (no al crear).

No es estado de servicio ISP ni de la OT. El modelo no tiene un estado de “nueva instalación” aparte de la ficha.

Adaptación mínima: `shouldSetPendingActivationOnInstallation` omite el cambio si `reusedExistingCustomer` y el cliente ya está `activo`.

### Tests

`npm run test:ot-1-4-1-customer-reuse`

Cubre reutilización Atención / Nueva OT / cambio de tipo, alta sin id, Comercial con/sin id, import con/sin id, payload `customer_id`, link de Atención, `createCustomer` solo sin id, y no degradar `activo`.

### Limitaciones pendientes

- Sin idempotencia de Guardar / doble click.
- Sin unique DNI/email/teléfono ni deduplicación.
- El alta nueva sigue sin persistir GPS en `createCustomer`.
- `applyCustomerToForm` sigue sin copiar DNI.
- Aprobar instalación reutilizada **sí** puede copiar calle/plan/tecnología de la OT a la ficha; solo se protege el **status** global.
- Cliente `inactivo` reutilizado puede pasar a `pendiente-activacion` (no es degradación de activo).
- Comercial no busca `customers.id` en la persona; solo `sourceCustomerId` de la oportunidad.

---

## 1. Causa raíz (auditoría 1.4)

`customerId` **no se pierde** en el formulario.

Se ignoraba en el **save**.

Punto exacto: `resolveCustomerIdForSave` en `components/tareas/task-work-order-dialog.tsx`.

Si `serviceType === "instalacion-nueva"` y el diálogo no está en edición:

1. Lee `form.customerId`.
2. **No lo usa.**
3. Llama siempre a `createCustomer(...)`.
4. Devuelve el id del cliente **recién creado**.
5. `performCreate` → `buildWorkOrderCreatePayload({ customerId })` → `addTask` → `insertTask` / RPC.

El `customerId` de Atención (y el de un cliente seleccionado a mano) queda en el estado React y en el payload **solo si** `resolveCustomerIdForSave` lo devolviera. Hoy no lo hace.

No hay pérdida en PostgreSQL. El FK `tasks.customer_id` acepta un cliente existente con `service_type = instalacion-nueva`. El código de creación **elige no reutilizarlo**.

```
Atención.customer_id  ──►  sessionStorage.customerId
                      ──►  form.customerId          (intactos tras OT 1.3)
                      ──X  resolveCustomerIdForSave  (siempre createCustomer)
                      ──►  payload.customerId        (id nuevo)
                      ──►  tasks.customer_id         (ficha duplicada)
```

## 2. Flujo actual

### 2.1 Atención → Generar OT → Instalación nueva

```
Atención (customer_atenciones.customer_id = C1)
  → OtLinkBlock.handleCreateWorkOrder
  → buildConsultationOtCreatePrefill({ customerId: C1 })
  → sessionStorage + /tareas?nuevaOt=1&atencionId&customerId
  → tasks-module lee prefill (C1)
  → dialog open:
       getDefaultWorkOrderForm()           // customerId = ""
       fetchCustomerById(C1)
       applyCustomerToForm(customer)       // customerId = C1
  → usuario elige "Instalación Nueva"
       applyWorkOrderServiceTypeChange     // conserva C1 (OT 1.3)
  → Guardar
       resolveCustomerIdForSave
         createCustomer({ name, dni, phone, email, address, locality, technology })
         return C2                         // C1 ignorado
       buildWorkOrderCreatePayload({ customerId: C2 })
       addTask → enrich GPS → createTask / RPC
       linkConsultationOtManagement(atencion, task)
         vincula la consulta a la OT
         NO exige task.customer_id === atencion.customer_id
```

Resultado:

- Consulta sigue apuntando a **C1**.
- OT apunta a **C2** (clon parcial: sin GPS, sin DNI si el form no lo tenía).
- Al aprobar, `pendiente-activacion` se aplica a **C2**, no a C1.

### 2.2 Cadena form → task

| Etapa | Campo | ¿Usa C1? |
|---|---|---|
| `ConsultationOtCreatePrefill.customerId` | C1 | sí |
| `form.customerId` | C1 | sí |
| `applyWorkOrderServiceTypeChange` | C1 | sí (OT 1.3) |
| `resolveCustomerIdForSave` (create + instalación nueva) | ignora form | **no** |
| `buildWorkOrderCreatePayload.customerId` | argumento, no `form.customerId` | el que le pasen |
| `CreateTaskPayload.customerId` | C2 | clon |
| `mapCreatePayloadToInsert` → `customer_id` | C2 | clon |
| RPC `create_task_with_execution_order` | `payload->>'customer_id'` | clon |
| `tasks.customer_id` | FK opcional a `customers.id` | C2 |

`buildWorkOrderCreatePayload` **sí** persiste el id que recibe. El corte está antes, en `resolveCustomerIdForSave`.

### 2.3 Caminos alternativos de creación de cliente durante OT

| Origen | Función | Criterio “es nuevo” |
|---|---|---|
| Dialog crear OT | `resolveCustomerIdForSave` → `useCustomers().createCustomer` | `serviceType === instalacion-nueva` y no es edición. **No mira customerId.** |
| Import CSV OT | `executeWorkOrderImport` | mismo: instalación nueva **siempre** `createCustomer`, aunque `row.data.customerId` exista. |
| Alta de cliente en Clientes | `customer-form-dialog` | alta explícita. |
| Import de clientes | `customer-import/execute` | fila de padrón. |
| Atención “cliente no registrado” | `createCustomerInSupabase` + `createCustomerAtencion` | alta rápida previa a la OT. |
| Onboarding ISP | `create_isp_onboarding` | `createCustomer: !existingCustomerId` — **sí** reutiliza si hay id. |
| Alta de servicio ISP | `createIspSubscriberService` | exige `customerId`; no crea ficha. |

No hay `upsertCustomer` ni `ensureCustomer` en el flujo OT.

## 3. Archivos involucrados

Lectura (sin cambios de comportamiento en este sprint):

- `components/tareas/task-work-order-dialog.tsx` — prefill, tipo, **save**
- `components/tareas/tasks-module.tsx` — hidrata Atención/Comercial
- `components/atencion-cliente/ot-link-block.tsx` — Generar OT
- `lib/customer-atenciones/consultation-ot-create.ts`
- `lib/tasks/work-order-customer-prefill.ts`
- `lib/tasks/work-order.ts` — `isNewInstallationWorkOrder`, `requiresCustomerLookup`, payload
- `lib/tasks/work-order-import/execute.ts` — mismo patrón en import
- `lib/tasks/customer-sync.ts` — sync post-creación **excluido** en instalación nueva
- `lib/tasks/work-order-approval-effects.ts` — efectos sobre `task.customerId`
- `lib/commercial/solicitud-ot-create.ts`
- `components/gestion-comercial/commercial-dossier-module.tsx`
- `components/clientes/customers-provider.tsx` — `createCustomer` real
- `lib/supabase/customers.queries.ts`
- `lib/supabase/tasks.mapper.ts`
- `components/tareas/tasks-provider/hooks/use-tasks-create.ts`
- `supabase/migrations/20260732000100_create_customers.sql` — FK
- `app/api/isp/onboarding/route.ts` — contraste: reutiliza `existingCustomerId`

Tests de reproducción (solo lectura): `scripts/test-ot-1-4-customer-integrity.mjs`

## 4. Dónde se ignora `customerId`

No se pierde al elegir tipo (eso era OT 1.3 y ya está corregido).

Se ignora aquí:

```849:872:components/tareas/task-work-order-dialog.tsx
  async function resolveCustomerIdForSave(): Promise<string | null> {
    const customerId = form.customerId.trim()

    if (isNewInstallationWorkOrder(form.serviceType)) {
      if (isEditMode) {
        return customerId || task?.customerId?.trim() || null
      }

      const customerResult = await createCustomer({
        name: form.customerName.trim(),
        dni: form.customerDni.trim() || undefined,
        phone: form.customerPhone.trim() || undefined,
        email: form.customerEmail.trim() || undefined,
        address: form.address.trim() || undefined,
        locality: form.locality.trim() || undefined,
        technology: form.technology || undefined,
      })
      // ...
      return customerResult.customer.id
    }
```

En edición **sí** reutiliza. En alta **nunca**.

UI alineada con esa regla vieja:

- `requiresCustomerLookup` es `serviceType !== "instalacion-nueva"`.
- Instalación nueva **no muestra** el buscador de cliente.
- El título es “Datos del cliente” (alta), no “Cliente” seleccionado.
- El nombre es editable.
- Placeholder DNI: “Documento o CUIT del **futuro** cliente”.

OT 1.3 hizo que Atención pudiera llenar `customerId` **sin** pasar por el buscador. El save no se enteró.

## 5. Comportamiento actual de instalación nueva

### Preguntas del sprint

**A) ¿Siempre debe crear un cliente nuevo?**

El código actual: **sí, en cada alta**. El modelo de datos: **no lo exige**.

**B) ¿Solo debe crear uno si NO existe `customerId`?**

Eso es compatible con:

- FK `tasks.customer_id` (nullable, `ON DELETE SET NULL`).
- Onboarding ISP (`createCustomer: !existingCustomerId`).
- Un cliente con varios `isp_services`.

Hay un matiz de aprobación (ver §11).

**C) ¿Hay un dato obligatorio de instalación que requiera una ficha nueva?**

No. DNI/CUIT, plan, medio de pago, GPS y FTTH viven en la OT (`customer_dni`, `contracted_plan`, `payment_method`, `latitude`/`longitude`/`shared_location`, metadata). Al aprobar se copian al cliente de `task.customer_id`. Ningún campo obliga a insertar otra fila en `customers`.

Además, el `createCustomer` del save **ni siquiera copia GPS** (`latitude` / `longitude` / `sharedLocation`). `applyCustomerToForm` **no copia DNI**. El clon sale más pobre que C1.

**D) ¿La OT puede asociarse a un cliente existente y ser instalación nueva?**

Sí. No hay CHECK `(service_type, customer_id)`. `isp_services.customer_id` admite varios servicios por abonado. `isp_services.source_task_id` puede apuntar a esa OT en un alta ISP posterior.

La intención histórica del form era: instalación nueva = **alta de abonado**. Por eso se oculta el lookup. Eso chocó con Atención, donde el abonado **ya existe**.

## 6. Atención

| Paso | Valor |
|---|---|
| Origen | `atencion.customerId` = `customers.id` |
| Prefill | `ConsultationOtCreatePrefill.customerId` |
| Storage | `sessionStorage` `bespoke.consultation-ot-prefill.{atencionId}` + query `customerId` |
| Form | `applyCustomerToForm` → `form.customerId` |
| Cambio de tipo | se conserva (OT 1.3) |
| Save | **se ignora**; se crea C2 |
| Link | `linked_task_id`; no compara clientes |

El `customerId` de Atención es el de la ficha operativa, no un id de persona comercial.

## 7. Comercial

Comparación:

| | Atención | Comercial |
|---|---|---|
| Entidad origen | `customers.id` | `commercial_people` + solicitud |
| Prefill trae `customerId` | **sí** | **no** (el tipo `SolicitudOtCreatePrefill` no lo tiene) |
| Tipo inicial | vacío (usuario elige) | `instalacion-nueva` |
| Save | crea C2 aunque C1 exista | crea C2 porque el form **no tiene** id |

`applySolicitudPrefillToForm` no setea `customerId`. Correcto para un lead que aún no es abonado.

Excepción no cableada: `commercial_opportunities.source_customer_id` existe cuando la oportunidad nace de Atención (`derive-from-customer-service.ts`). **No se copia** al prefill de OT. Generar OT desde esa solicitud también crea ficha nueva.

Comercial **no reutiliza** un `customers.id` aunque la persona ya esté vinculada a uno.

## 8. Creación manual

| Caso | `form.customerId` al guardar | Resultado actual |
|---|---|---|
| Nueva OT → tipo instalación nueva (sin buscar) | `""` | Crea cliente. **Correcto** para alta real. |
| Nueva OT → otro tipo → seleccionar C1 → cambiar a instalación nueva | C1 (OT 1.3) | Crea C2. **Duplicado.** |
| Nueva OT → seleccionar C1 → service-técnico / reconexión / baja… | C1 | Reutiliza. Lookup obligatorio. |

No hay forma de buscar un cliente ya estando en instalación nueva: el buscador está oculto.

## 9. Riesgo de duplicados

`createCustomer` hace `INSERT` directo. No hay unique de DNI, CUIT, email ni teléfono. `customers.dni` es índice no único (`20260819000100`). Unique real: `customer_number` (`CLI-000001`).

El save de OT **no consulta** `getImportDuplicateIndex` ni `listExistingCustomersByDni` (eso es import / onboarding ISP).

Criterio actual de “nuevo”: el tipo de OT, no la identidad.

Vectores:

| Señal | ¿Evita duplicado en OT? |
|---|---|
| `customerId` | no (instalación nueva lo ignora) |
| DNI / CUIT | no (además el prefill no copia DNI) |
| email / teléfono | no |
| nombre + domicilio | no |

Tras duplicar:

- Padrones: dos CLI con el mismo nombre/teléfono/calle.
- Atención en C1; OT y aprobación en C2.
- ISP onboarding por DNI de la OT: si el DNI del form está vacío, no encuentra C1 (`listExistingCustomersByDni`).

El provider de clientes **tampoco** persiste GPS aunque `NewCustomerInput` lo permita.

## 10. Riesgo de doble creación

No hay idempotencia de creación de OT (OT 1.1 lo documentó: no existe key). Cliente + task **no son una transacción**.

| Escenario | Qué pasa |
|---|---|
| Doble click en Guardar | `isSubmitting` se prende **después** de `validateBeforeSave` (fotos). Durante esa espera el botón sigue habilitado. Dos `createCustomer` + dos `addTask` son posibles. |
| Red lenta | igual: no hay lock de request. |
| Cliente OK, OT falla | queda C2 huérfano. Reintento crea **C3**. |
| OT OK, UI pierde la respuesta | la OT existe; reabrir Atención y volver a Generar OT crea otra OT + otro cliente. El link de la consulta ya resuelta falla (`CONSULTATION_ALREADY_RESOLVED`) si no queda `generar_ot` en follow-up. |
| Guardar dos veces con éxito (caso F) | el dialog cierra y limpia prefill. Segunda vez = otro alta completo si el usuario vuelve a Generar OT. |

`customer_number` se calcula leyendo el último número (no hay lock de secuencia). Dos altas concurrentes pueden chocar en unique `CLI-…`; una falla, la otra no. No hay rollback del otro insert.

## 11. Regla funcional recomendada

Compatible con el modelo actual:

```
SI form.customerId es un uuid existente:
    usar ese cliente
    NO crear otro

SI no hay customerId y el tipo es instalacion-nueva:
    crear ficha (alta real)

SI no hay customerId y el tipo exige lookup:
    bloquear (comportamiento actual)
```

Eso cubre Atención, selección manual + cambio de tipo, e instalación nueva en blanco.

**Matiz de aprobación (no bloquea reutilizar, pero hay que tenerlo en cuenta en OT 1.5+):**

`buildInstalacionNuevaUpdate` pone `customers.status = pendiente-activacion` sobre **toda** la ficha. Si C1 ya es abonado `activo` con `isp_services`, reutilizar + aprobar podría bajar el estado comercial del abonado. Opciones a evaluar en implementación (no ahora):

- reutilizar y **no** tocar `status` si ya hay servicio ISP activo;
- o crear servicio nuevo (`isp_services`) en lugar de clonar `customers`;
- o mostrar confirmación si C1 ya es abonado activo.

Para el caso Atención (cliente de consulta, a menudo sin servicio o en alta), reutilizar C1 es lo correcto.

Comercial: seguir creando ficha si no hay `customers.id`. Si más adelante se copia `sourceCustomerId` al prefill, la misma regla aplica.

Import CSV: si la fila ya trae `customerId`, no insertar otro.

## 12. Propuesta técnica (no implementada)

1. En `resolveCustomerIdForSave`, rama instalación nueva / create:

   ```
   if (customerId) return customerId  // opcional: fetchCustomerById para 404
   return createCustomer(...)
   ```

2. Mismo criterio en `executeWorkOrderImport`.

3. UI: si hay `customerId` en instalación nueva, tratarlo como cliente seleccionado (nombre de solo lectura, no “futuro cliente”). Seguir ocultando lookup para el alta en blanco.

4. Al **crear** ficha nueva (sin id): copiar GPS y DNI del form. No aplica si se reutiliza.

5. `applyCustomerToForm`: copiar `dni` → `customerDni` para que la OT y el onboarding ISP vean el documento de C1.

6. No tocar RPC OT 1.1, migraciones, vencidas, Planning ni Facturación.

7. Idempotencia cliente+OT: fuera de alcance (igual que OT 1.1).

8. Comercial `sourceCustomerId`: sprint aparte; hoy el prefill no lo transporta.

## 13. Tests

Existentes que **no** cubren el save de `customerId`:

- `test:ot-1-3-location` — el form conserva id; no ejecuta `resolveCustomerIdForSave`.
- `test-customer-atenciones-rc-3-2-6-ot-create` — href/prefill traen `customerId`; no el save.
- `test:work-order-contact-commercial-hotfix` — DNI/CUIT en payload de instalación nueva, no reutilización.
- `test:ot-1-1-execution-order-atomic` — confirma que no hay idempotency key.

Reproducción OT 1.4: `npm run test:ot-1-4-customer-integrity`

Tests que harán falta en la **corrección** (OT 1.5):

1. Atención → instalación nueva → payload.customerId === C1 (no createCustomer).
2. Atención → cambiar tipo a instalación nueva → igual.
3. Manual: seleccionar C1 → cambiar a instalación nueva → reutiliza.
4. Manual: instalación nueva sin id → sí crea.
5. Comercial sin id → sí crea.
6. Comercial con `sourceCustomerId` (si se cablea).
7. Import instalación nueva con customerId → no crea.
8. Edit instalación nueva → no crea.
9. `createCustomer` no se llama si hay id.
10. GPS/DNI del clon (solo si sigue existiendo el camino de alta).
11. Aprobación sobre C1 reutilizado (regresión de `pendiente-activacion`).

No se modificaron tests de OT 1.1 / 1.2 / 1.3.

## 14. Riesgos / regresiones

| Riesgo | Notas |
|---|---|
| Reutilizar C1 activo + aprobar | `pendiente-activacion` sobre abonado ya operativo. |
| UI de “alta” con id presente | usuario puede editar nombre/DNI creyendo que crea otro; si se reutiliza, esos cambios **no** van a la ficha (no hay sync en instalación nueva: `shouldOfferCustomerSync` la excluye). |
| Import | mismo bug; cambiar dialog y no import deja CSV duplicando. |
| Comercial | no cambia si no hay id; no romper alta de leads. |
| RPC / execution_order | el id viaja en el JSON del RPC; no hace falta cambiar SQL. |
| Facturación / Planning | no dependen de este save. |
| Idempotencia | queda pendiente; reutilizar id reduce duplicados de **ficha**, no de **OT** por doble click. |

## Casos A–F — qué pasa hoy vs qué debería pasar

| Caso | Hoy | Debería |
|---|---|---|
| A Atención → existente → instalación nueva | C2 | C1 |
| B Comercial → “existente” (persona) → instalación nueva | C2 (no hay customers.id) | C2, salvo que se copie `sourceCustomerId` |
| C Manual → seleccionar existente → instalación nueva | C2 | C1 |
| D Manual → cliente nuevo → instalación nueva | C2 | C2 |
| E Atención → cambiar tipo → guardar | si termina en instalación nueva: C2; si no: C1 | el id del form |
| F Atención → instalación nueva → guardar dos veces | 1ª: C2+OT; 2ª: C3+OT si reabre el flujo | 1ª: C1+OT; 2ª: bloquear link / no clonar ficha |

## Limitación de esta auditoría

No se recorrió el flujo en navegador. La reproducción es por lectura de código + tests de dominio/fuente. No se insertó nada en DB.
