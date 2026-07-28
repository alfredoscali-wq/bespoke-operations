# Bespoke Operations

## Master Project Context

**Versión:** 1.0

**Última actualización:** 27/07/2026

**Estado:** Desarrollo Activo

---

> Este documento constituye la referencia oficial del proyecto.
>
> Toda decisión arquitectónica deberá ser consistente con este documento.
>
> Ante conflictos entre conversaciones anteriores y este documento,
> prevalece siempre este documento.

## 1. VISIÓN DEL PRODUCTO

Bespoke Operations no es solamente un ERP. Es una plataforma integral para administrar empresas de servicios en campo, con foco inicial en telecomunicaciones, ISP y empresas con cuadrillas operativas. El objetivo no es únicamente administrar información. El objetivo es ayudar a tomar decisiones operativas en tiempo real.

**Toda la plataforma se diseña pensando en:**

- simplicidad de uso
- velocidad operativa
- trazabilidad absoluta
- automatización
- reutilización de componentes
- escalabilidad

La plataforma debe poder crecer durante años sin necesidad de rediseñar su arquitectura.

---

### Objetivo de largo plazo

Construir una plataforma capaz de administrar completamente una empresa de servicios.

**Incluyendo:**

- Recursos Humanos
- Comercial
- Clientes
- Atención al Cliente
- Obras
- Órdenes de Trabajo
- Planning
- Cuadrillas
- Agenda
- Automatizaciones
- Reportes
- Inteligencia Operativa
- Aplicaciones Mobile
- IA

Todos los módulos deberán compartir los mismos motores internos (Engines).

## 2. FILOSOFÍA DEL PRODUCTO

Existen varios principios que guían absolutamente todo el desarrollo.

---

### 2.1 El sistema debe ayudar a decidir.

No queremos un sistema que solamente almacene información.

**Queremos un sistema que permita entender rápidamente:**

- qué está pasando
- qué debería hacerse
- qué está mal
- qué requiere atención

---

### 2.2 Las pantallas operativas muestran el presente.

Las pantallas de operación deben responder únicamente preguntas del presente.

**Ejemplos:**

¿Qué tengo que hacer ahora? ¿Qué está pendiente? ¿Qué cuadrilla está trabajando? ¿Qué cliente necesita atención? Los análisis históricos pertenecen al Reporting Engine. Nunca deben contaminar la experiencia operativa.

---

### 2.3 Toda acción importante genera evidencia.

Cada acción realizada por un usuario debe poder reconstruirse. No solamente mediante logs. Sino mediante Activity Engine. El sistema debe permitir reconstruir exactamente qué ocurrió.

---

### 2.4 Los Engines son el corazón del sistema.

Las pantallas son solamente una representación visual. Toda la lógica importante vive dentro de motores reutilizables. Un mismo Engine puede ser utilizado por múltiples módulos.

---

### 2.5 Mobile y Web son clientes de una misma plataforma.

No existen productos separados. Existe una única plataforma. Bespoke Operations (Web) Bespoke Mobile (Android) Ambos consumen la misma lógica de negocio.

## 3. PRINCIPIOS DE ARQUITECTURA

La arquitectura sigue un enfoque Engine First. No se desarrolla funcionalidad directamente sobre pantallas. Se desarrollan motores reutilizables. Luego las pantallas utilizan esos motores.

---

### Principios generales

- Repository Pattern
- Service Layer
- Componentes React delgados
- Lógica de negocio desacoplada
- Soft Delete
- Multiempresa
- RLS (Row Level Security)
- Auditoría permanente
- Motores reutilizables
- Eventos antes que estados
- Configuración centralizada
- Compatibilidad hacia atrás siempre que sea posible

---

Objetivo Evitar código duplicado. Evitar lógica mezclada con UI. Evitar dependencias entre módulos.

## 4. STACK TECNOLÓGICO

WEB Next.js React TypeScript Tailwind CSS shadcn/ui

---

Backend Supabase PostgreSQL Row Level Security Storage Realtime (cuando sea necesario)

---

Mobile Android Kotlin Jetpack Compose Room Repository Pattern Offline First

---

Control de versiones Git GitHub

---

Deploy Vercel Supabase Cloud

## 5. ESTRUCTURA GENERAL DEL SISTEMA

El sistema se divide en módulos funcionales. Cada módulo utiliza motores compartidos. Los módulos no deben duplicar lógica.

**Ejemplo:**

Planning ↓ utiliza Activity Engine ↓ utiliza Notification Engine ↓ utiliza Reporting Engine No existen dependencias directas entre pantallas. Todo debe pasar por motores reutilizables.

## 6. REGLAS GENERALES DE DESARROLLO

**Toda nueva funcionalidad debe respetar:**

- reutilización antes que duplicación
- motores compartidos
- arquitectura desacoplada
- compatibilidad hacia atrás
- código mantenible
- UI simple
- operaciones rápidas
- consistencia visual

---

Antes de crear una nueva funcionalidad debe evaluarse si ya existe un Engine capaz de resolverla. Si existe, debe extenderse. No crear motores duplicados.

## 7. METODOLOGÍA DE TRABAJO

Todo desarrollo sigue el mismo flujo.

## 1. Diseño funcional

↓

## 2. Diseño técnico

↓

## 3. Sprint para Cursor

↓

## 4. Implementación

↓

## 5. QA

↓

## 6. Ajustes

↓

## 7. Commit

↓

## 8. Push

Nunca realizar Commit antes del QA. Nunca realizar Push sin validación.

## 8. CONVENCIÓN DE PROMPTS

**Todos los prompts para Cursor deberán comenzar con:**

**PROYECTO:**

**Repositorio esperado:**

**Tipo de Sprint:**

**Ejemplo:**

**PROYECTO:** Bespoke Operations

**Repositorio esperado:** bespoke-operations

**Tipo:**

Backend Esto evita ejecutar un Sprint en el repositorio incorrecto.

---
# PARTE 2 — ESTADO FUNCIONAL DE LOS MÓDULOS

**Versión:** 1.0 **Fecha:** 27/07/2026

Esta sección describe el estado actual de cada módulo del sistema, las funcionalidades implementadas, las decisiones tomadas y el roadmap previsto.

## 1. DASHBOARD

**Estado:** IMPLEMENTADO

**Objetivo:**

Ser el punto de entrada del sistema. No pretende reemplazar los reportes. Debe mostrar únicamente información operativa del día.

**Debe responder rápidamente:**

- ¿Cómo está la empresa hoy?
- ¿Qué requiere atención?
- ¿Qué está vencido?
- ¿Qué debe hacerse ahora?

**El Dashboard utilizará información proveniente de:**

- Planning Engine
- Activity Engine
- Reporting Engine
- Automation Engine

No contiene lógica propia.

## 2. RRHH

**Estado:** IMPLEMENTADO

**Incluye:**

- Empleados
- Roles
- Cuadrillas
- Disponibilidad
- Usuarios
- Permisos
- Autenticación

**Cada empleado posee:**

- Usuario de sistema
- Área
- Rol
- Empresa
- Cuadrilla (opcional)
- Estado

La autenticación utiliza Supabase Auth. Los permisos se controlan mediante Roles y módulos visibles. Todo preparado para múltiples empresas.

---

Pendiente

- Vacaciones
- Licencias
- Historial laboral
- Capacitación
- Evaluaciones

## 3. CLIENTES

**Estado:**

IMPLEMENTADO El módulo Clientes representa únicamente al cliente. No contiene información operativa.

**Se relaciona posteriormente con:**

- Atención
- Obras
- OT
- Comercial
- Facturación

---

Pendiente Historial unificado del cliente.

## 4. OBRAS

**Estado:**

IMPLEMENTADO Las Obras representan trabajos de mayor tamaño. Una Obra puede contener múltiples OT.

**Se implementó:**

- Alta
- Edición
- Inicio
- Estado
- Cuadrillas
- GPS

---

Decisión importante El GPS pertenece a la Obra. No a cada OT. Las OT utilizan el GPS de la Obra. Esto evita inconsistencias.

---

Estados Planificada

↓

Activa

↓

Finalizada

---

Pendiente Mapa de Obras.

## 5. ÓRDENES DE TRABAJO (OT)

**Estado:**

IMPLEMENTADO Las OT representan la unidad operativa principal.

**Workflow actual:**

- Programada
- ↓
- Asignada
- ↓
- En Curso
- ↓
- Pendiente de Cierre
- ↓
- Finalizada

---

**Cada OT posee:**

- Cliente
- Servicio
- Dirección
- GPS
- Horario
- Duración
- Materiales
- Checklist
- Fotos
- Incidentes
- Importe
- IP Instalación
- Tecnología

---

Implementado Cambio de domicilio Importe a cobrar Tecnología IP instalación Checklist Fotos Incidentes Reprogramación Asignación Orden de ejecución

---

Pendiente Historial operativo enriquecido.

## 6. PLANNING

**Estado:**

IMPLEMENTADO Es uno de los módulos centrales del sistema. Permite organizar el trabajo diario.

**Actualmente permite:**

- Asignar cuadrillas
- Reordenar OT
- Modificar duración
- Modificar turno
- Programar fechas
- Mover OT

---

Decisiones UX Se eliminó información histórica. Se priorizó velocidad.

**La pantalla responde:**

- ¿Qué tengo hoy?
- ¿Qué falta?
- ¿Qué puedo mover?

---

Pendiente Optimización automática. IA. Sugerencias de planificación.

## 7. CALENDARIO OPERATIVO

**Estado:**

IMPLEMENTADO Visualización temporal del Planning. No contiene lógica. Consume información del Planning Engine.

## 8. ATENCIÓN AL CLIENTE

**Estado:**

IMPLEMENTADO Es uno de los módulos más evolucionados.

**El concepto central es:**

Expediente. Cada interacción queda registrada.

---

Implementado Alta Seguimientos Timeline Adjuntos Resoluciones Generación OT Derivaciones Estados Motivos Resultados

---

Decisión importante El expediente nunca pierde información. Todo queda registrado cronológicamente.

---

Cambios recientes Attachment Engine integrado. Timeline mejorado. Visor de imágenes. Historial. Referencias temporales.

---

Pendiente Automatizaciones. Métricas. Reporting específico.

## 9. COMERCIAL

**Estado:**

EN DESARROLLO Arquitectura completamente definida.

**Conceptos centrales:**

- Persona
- ↓
- Oportunidad
- ↓
- Expediente Comercial
- ↓
- Cliente

---

Se descartó utilizar Prospectos. Todo comienza desde Persona.

---

Roadmap implementado

### 1.0 Fundación

### 1.1 Nueva oportunidad

### 1.2 Expediente

### 1.3 Activity Engine

### 1.4 Timeline

### 1.5 Territorio

### 1.6 Home Comercial

### 1.7 Pipeline

---

Pendiente Agenda comercial. Visitas. Presencia comercial. Integración Mobile.

## 10. BESPOKE MOBILE

**Estado:**

EN DESARROLLO AVANZADO La aplicación ya no será solamente Field Agent.

**Pasa a convertirse en:** Bespoke Mobile.

---

Arquitectura Module Router

↓

Módulos según permisos. No múltiples APK.

---

Implementado Media Pipeline Presence Engine GPS configurable Arquitectura modular Offline Room Sincronización automática

---

Pendiente Commercial Module.

## 11. AUTOMATIZACIONES

**Estado:**

DISEÑADO Todavía no desarrollado completamente. El objetivo es automatizar procesos. Ejemplos Crear actividades. Enviar notificaciones. Recordatorios. Escalamientos. Seguimientos. Todo reutilizando Automation Engine.

## 12. REPORTING

**Estado:**

DISEÑADO No se pretende utilizar pantallas operativas para históricos. Todo el análisis histórico pertenece aquí.

---

Ejemplos Productividad KPIs Tiempo de atención Tiempo en cliente Cumplimiento Fotos Incidentes Materiales GPS Presencia

---

Todos los módulos deberán alimentar Reporting Engine.

## 13. IA

**Estado:**

PLANIFICADO La Inteligencia Artificial será transversal. No un módulo separado.

**Utilizará información de:**

- Planning
- Activity
- Reporting
- Presence
- Automation
- Comercial

---

Ejemplos futuros Predicción de carga. Optimización de rutas. Priorización automática. Detección de desvíos. Recomendaciones. Asistentes.

## 14. ESTADO GENERAL

IMPLEMENTADO ✓ Dashboard ✓ RRHH ✓ Clientes ✓ Obras ✓ OT ✓ Planning ✓ Calendario ✓ Atención al Cliente ✓ Attachment Engine ✓ Arquitectura Mobile

---

EN DESARROLLO

- Comercial
- Bespoke Mobile
- Presence Backend

---

PENDIENTE

- Reporting
- Automation
- IA
- Analítica avanzada

BESPOKE OPERATIONS MASTER PROJECT CONTEXT PARTE 3 ENGINE ARCHITECTURE Versión: 1.0 Fecha: 27/07/2026

Esta sección documenta todos los Engines (motores) del sistema. Los Engines representan el núcleo de Bespoke Operations. Las pantallas nunca deben contener lógica compleja. Toda la lógica de negocio debe vivir dentro de Engines reutilizables. Un Engine puede ser utilizado simultáneamente por múltiples módulos.

FILOSOFÍA

La arquitectura de Bespoke Operations es Engine First.

**Esto significa:**

- UI
- ↓
- Service
- ↓
- Engine
- ↓
- Repository
- ↓
- Base de Datos

**Nunca:**

- UI
- ↓
- SQL
- o
- UI
- ↓
- Business Logic

---

**Los Engines deben ser:**

- reutilizables
- desacoplados
- testeables
- independientes de la interfaz
- independientes del módulo que los consume

## 1. PLANNING ENGINE

Estado IMPLEMENTADO Objetivo Administrar toda la planificación operativa.

**Debe convertirse en el único responsable de:**

- programación
- asignación
- reprogramación
- prioridades
- orden de ejecución
- disponibilidad
- carga operativa

---

Consumidores Planning Calendario Dashboard Automation Engine Reporting Engine

---

Futuro Optimización automática IA Balanceo de carga Replanificación automática

## 2. ACTIVITY ENGINE

Estado IMPLEMENTADO Objetivo Registrar todas las acciones importantes del sistema. No guarda estados. Guarda hechos. Ejemplos Empleado asignado. OT creada. OT iniciada. Foto subida. Cliente atendido. Incidente registrado. Archivo agregado. Seguimiento realizado.

---

Principio Los hechos nunca se modifican. Los hechos solamente se agregan.

---

Canónico oficial (ADR-009) `lib/activity-engine`. Escrituras nuevas vía `activity.record()` o bridges oficiales. Memoria histórica de hechos relevantes del negocio y fuente transversal para Reporting, Automation e IA.

---

Consumidores Todos los módulos.

---

Futuro Motor principal de auditoría. Base para IA. Base para Reporting.

## 3. ATTACHMENT ENGINE

Estado IMPLEMENTADO Uno de los Engines más importantes. Nació para Atención al Cliente. Ahora es completamente reutilizable.

---

Responsabilidad Administrar archivos. No importa quién los utilice.

---

Ejemplos Fotos PDF Audios Videos Documentación

---

Consumidores actuales Atención al Cliente.

---

Consumidores futuros Comercial. OT. RRHH. Clientes. Obras. Reportes.

---

Principio Un único Attachment Engine para todo el sistema. Nunca duplicar almacenamiento de archivos.

## 4. PRESENCE ENGINE

Estado IMPLEMENTADO EN MOBILE BACKEND EN DESARROLLO

---

Objetivo Medir presencia física real. No estados administrativos.

---

Eventos ENTER_RADIUS HEARTBEAT EXIT_RADIUS

---

Información registrada Empleado OT GPS Hora Precisión Proveedor GPS Dispositivo

---

Principio Medimos presencia. No solamente inicio y fin de OT.

---

Backend Persistencia API Mobile Validaciones Servicios internos

---

Futuro Mapa Timeline Tiempo efectivo Alertas Heatmaps Productividad

## 5. REPORTING ENGINE

Estado Arquitectura Accepted (ADR-010). Implementación pendiente. Migración gradual.

---

Objetivo Centralizar absolutamente todos los indicadores históricos. Nunca contaminar pantallas operativas.

---

Canónico oficial (ADR-010 Accepted) Motor canónico de lectura analítica y fuente única para reportes históricos. Solo lee; nunca escribe, modifica ni registra eventos. Interpreta dominios (estado) + Activity (hechos) + Presence (presencia / tiempo efectivo). Dashboard = presente; Reporting = período. `lib/reports` = legacy; `lib/reporting-engine` se construye progresivamente. Documento: `docs/architecture/adr/ADR-010-reporting-engine-canonical.md`.

---

Obtendrá información desde Activity Engine Planning Engine Presence Engine Automation Engine Attachment Engine

---

Ejemplos KPIs Productividad Tiempos Incidentes Materiales Presencia Atenciones Ventas Conversión

## 6. AUTOMATION ENGINE

Estado DISEÑADO

---

Objetivo Ejecutar acciones automáticas. Nunca depender de pantallas.

---

Ejemplos Crear tareas. Enviar emails. Crear actividades. Recordatorios. Escalamientos. Cambios de estado. Alertas.

## 7. NOTIFICATION ENGINE

Estado DISEÑADO

---

Objetivo Centralizar todas las notificaciones.

---

Canales futuros Push Email WhatsApp SMS Notificaciones internas

## 8. MEDIA PIPELINE

Estado IMPLEMENTADO EN MOBILE

---

Objetivo Procesar imágenes antes del upload.

---

Pipeline Leer imagen

↓

Corregir EXIF

↓

Resize

↓

Compresión

↓

Upload

---

Beneficios Menor consumo. Mayor velocidad. Mejor experiencia. Sin modificar backend.

## 9. AUTH ENGINE

Estado IMPLEMENTADO

---

Responsabilidad Autenticación. Autorización. Roles. Módulos. Empresa. Permisos.

---

Futuro Módulos dinámicos. Permisos avanzados.

## 10. AUDIT ENGINE

Estado PARCIAL

---

Actualmente Activity Engine cubre gran parte.

---

Objetivo futuro Auditoría transversal. Cambios. Eliminaciones. Permisos. Configuraciones.

## 11. FUTUROS ENGINES

Roadmap AI Engine Prediction Engine Scheduling Optimizer Route Optimization Billing Engine Inventory Engine Document Engine Knowledge Engine Analytics Engine

RELACIÓN ENTRE ENGINES

Planning Engine

↓

genera

↓

Activity Engine

↓

alimenta

↓

Reporting Engine

---

Presence Engine

↓

genera eventos

↓

Activity Engine

↓

Reporting Engine

---

Attachment Engine

↓

registra archivos

↓

Activity Engine

↓

Reporting Engine

---

Automation Engine

↓

ejecuta acciones

↓

Activity Engine

↓

Notification Engine

REGLAS DE DISEÑO

1. Si una funcionalidad puede reutilizar un Engine existente, NO crear uno nuevo.

---

2. Los Engines nunca deben conocer la UI.

---

3. Los Engines nunca deben depender de React.

---

4. Los Engines nunca deben depender de Android.

---

5. Toda lógica reutilizable debe vivir dentro de un Engine.

---

6. Las pantallas solamente muestran información. Nunca toman decisiones importantes.

---

7. Los Engines pueden utilizar otros Engines, pero evitando dependencias circulares.

DECISIONES ARQUITECTÓNICAS (ADR)

ADR-001 Engine First Architecture.

---

ADR-002 Las pantallas operativas muestran únicamente el presente.

---

ADR-003 Los históricos pertenecen exclusivamente al Reporting Engine.

---

ADR-004 Toda acción importante genera Activity.

---

ADR-005 Attachment Engine único para todo el sistema.

---

ADR-006 Presence mide presencia física, no estados administrativos.

---

ADR-007 Mobile y Web son clientes de la misma plataforma.

---

ADR-008 Los Engines son reutilizables por cualquier módulo.

---

ADR-009 Activity Engine canónico en `lib/activity-engine`. Toda nueva integración registra eventos con `activity.record()` (o bridges oficiales que desemboquen en él). Constituye la memoria histórica de los hechos relevantes del negocio y será la fuente transversal para Reporting, Automation e IA. Documento: `docs/architecture/adr/ADR-009-activity-engine-canonical.md`.

---

ADR-010 Reporting Engine canónico (Accepted): motor oficial de lectura analítica y fuente única para reportes históricos. Solo lee; nunca escribe, modifica ni registra eventos. Dominios = estado; Activity = hechos; Presence = presencia / tiempo efectivo. Dashboard = ahora; Reporting = período. `lib/reports` = legacy; `lib/reporting-engine` = construcción progresiva. Documento: `docs/architecture/adr/ADR-010-reporting-engine-canonical.md`.

Esta sección documenta la evolución del proyecto, las decisiones de diseño más importantes y el razonamiento detrás de cada una. El objetivo es conservar el conocimiento del proyecto y evitar perder contexto con el paso del tiempo.

## 1. ORIGEN DEL PROYECTO

**Bespoke Operations nació con un objetivo simple:** Administrar empresas de telecomunicaciones y cuadrillas técnicas.

**Inicialmente el foco estaba en:**

- Clientes
- Obras
- Órdenes de Trabajo
- Técnicos

Con el tiempo el proyecto evolucionó hasta convertirse en una plataforma integral para empresas de servicios. La visión dejó de ser un ERP tradicional. El objetivo pasó a ser construir una plataforma inteligente capaz de ayudar a tomar decisiones operativas.

## 2. EVOLUCIÓN DE LA ARQUITECTURA

Al comienzo gran parte de la lógica estaba distribuida entre pantallas. Durante el crecimiento del proyecto se decidió migrar hacia una arquitectura basada en Engines.

**Motivos:**

- evitar código duplicado
- reutilizar lógica
- facilitar mantenimiento
- permitir crecimiento sin rediseños

Esta decisión marcó el rumbo definitivo del proyecto. Hoy toda funcionalidad nueva debe pensarse primero como Engine y recién después como pantalla.

## 3. EVOLUCIÓN DEL MÓDULO COMERCIAL

Inicialmente se pensó un CRM tradicional basado en Prospectos. Luego de varios análisis se descartó completamente ese enfoque.

**Se adoptó el siguiente modelo:**

Persona ↓ Oportunidad ↓ Expediente Comercial ↓ Cliente Este cambio simplificó enormemente el modelo de datos y eliminó duplicación de información. La Persona pasó a ser la entidad principal.

## 4. DECISIÓN SOBRE EL EXPEDIENTE

Una de las decisiones más importantes del proyecto. Todo proceso importante debe tener un Expediente.

**Ejemplos:**

- Expediente Comercial
- Expediente de Atención

**En el futuro:**

Expediente de RRHH Expediente de Proveedor Expediente de Proyecto El expediente representa la historia completa de un proceso. Nunca se elimina información. Toda acción queda registrada cronológicamente.

## 5. TIMELINE COMO CONCEPTO CENTRAL

Se decidió abandonar pantallas separadas para historial. Toda la historia debe visualizarse mediante Timeline.

**Ventajas:**

- lectura simple
- trazabilidad
- auditoría
- reutilización

Todo expediente utiliza el mismo concepto.

## 6. ACTIVITY ENGINE

Originalmente los módulos registraban información de forma independiente. Se decidió crear un motor común.

**Concepto principal:**

Registrar hechos. No estados.

**Ejemplos:**

OT creada. OT iniciada. Foto subida. Cliente atendido. Archivo agregado. Seguimiento realizado.

**Esto permitirá posteriormente:**

Reporting. Auditoría. IA. Automatizaciones.

## 7. ATTACHMENT ENGINE

Inicialmente las imágenes pertenecían exclusivamente a Atención. Se detectó rápidamente que el mismo problema aparecería en otros módulos. Se decidió crear un Attachment Engine reutilizable.

**Actualmente:** Atención utiliza Attachment Engine.

**En el futuro:**

RRHH. Comercial. OT. Clientes. Obras. Reportes. Toda la plataforma utilizará el mismo sistema de archivos.

## 8. FIELD AGENT → BESPOKE MOBILE

Originalmente existía una aplicación llamada Field Agent. Su único objetivo era asistir técnicos. Posteriormente se decidió transformarla en una plataforma Mobile.

**Nuevo concepto:**

Bespoke Mobile. Una única aplicación. Múltiples módulos. Los permisos determinan qué funcionalidades aparecen. No existirán múltiples APK.

## 9. MEDIA PIPELINE

Durante las pruebas se detectó un consumo excesivo de datos por fotografías. Se decidió implementar un procesamiento local.

**Pipeline:**

- Leer imagen
- ↓
- Corregir EXIF
- ↓
- Resize
- ↓
- Compresión JPEG
- ↓
- Upload

**Resultado:**

Menor tráfico. Mayor velocidad. Sin modificar backend.

## 10. PRESENCE ENGINE

Una de las decisiones estratégicas más importantes.

**Inicialmente el sistema medía solamente:**

Inicio OT. Fin OT. Se concluyó que eso no representaba el trabajo real. Se creó el concepto Presence Engine.

**El sistema ahora registra:**

- ENTER_RADIUS
- HEARTBEAT
- EXIT_RADIUS

**Esto permitirá medir:**

Tiempo real en cliente. Productividad. Cumplimiento. Mapas. Alertas. Heatmaps.

## 11. GPS

Otra decisión importante. El servidor siempre será la autoridad. El móvil puede validar. Pero la validación definitiva pertenece al backend. También se decidió centralizar el radio operativo.

**Actualmente:**

150 metros. En el futuro deberá configurarse desde el servidor.

## 12. FILOSOFÍA DE LAS PANTALLAS

**Se decidió separar completamente:**

Operación de Análisis. Las pantallas operativas muestran solamente el presente. Los históricos pertenecen exclusivamente al Reporting Engine. Esto simplifica enormemente la experiencia del usuario.

## 13. DISEÑO UX

Se adoptaron varios principios.

**Las pantallas deben:**

- ser simples
- rápidas
- mostrar únicamente información necesaria
- minimizar clics
- evitar sobrecarga visual

La velocidad de operación es más importante que mostrar mucha información.

## 14. DECISIONES MOBILE

Offline First. Room. Repository Pattern. Sincronización silenciosa. Compatibilidad hacia atrás. No bloquear al técnico por problemas de red. El móvil debe continuar funcionando incluso sin backend disponible.

## 15. EVOLUCIÓN DE LOS SPRINTS

Grandes hitos del proyecto. RRHH.

↓

Planning.

↓

Calendario.

↓

Obras.

↓

OT.

↓

Atención al Cliente.

↓

Attachment Engine.

↓

Comercial.

↓

Bespoke Mobile.

↓

Media Pipeline.

↓

Presence Engine.

↓

Presence Backend.

↓

Reporting.

↓

Automation.

↓

IA.

## 16. LECCIONES APRENDIDAS

No duplicar lógica. No crear motores específicos cuando uno reutilizable puede resolverlo. Pensar siempre en escalabilidad. Las pantallas cambian. Los Engines permanecen. Diseñar primero la arquitectura. Implementar después la interfaz.

## 17. ESTADO ACTUAL

El proyecto dejó de ser un MVP. Actualmente posee una arquitectura suficientemente madura para evolucionar durante muchos años. La prioridad ya no es solamente agregar funcionalidades. La prioridad es mantener la coherencia arquitectónica. Cada nueva decisión debe respetar los principios definidos en este documento. BESPOKE OPERATIONS MASTER PROJECT CONTEXT PARTE 5 ROADMAP ESTRATÉGICO Y VISIÓN DE FUTURO Versión: 1.0 Fecha: 27/07/2026

Esta sección documenta el roadmap estratégico del proyecto. No representa una lista cerrada de tareas. Representa la dirección hacia donde evolucionará Bespoke Operations durante los próximos años. Las prioridades podrán modificarse. La visión general del producto no.

OBJETIVO GENERAL

Convertir Bespoke Operations en una plataforma integral para empresas de servicios. No solamente administrar operaciones. Sino ayudar a decidir. Automatizar procesos. Medir productividad. Predecir problemas. Optimizar recursos. Asistir a los usuarios mediante Inteligencia Artificial.

ROADMAP GENERAL

FASE 1 Fundación (Completada) ✓ Arquitectura ✓ RRHH ✓ Obras ✓ OT ✓ Planning ✓ Atención ✓ Comercial (estructura) ✓ Mobile

---

FASE 2 Motores Compartidos (En desarrollo) Activity Engine Attachment Engine Presence Engine Automation Engine Reporting Engine

---

FASE 3 Analítica KPIs Reportes Métricas Productividad Indicadores

---

FASE 4 Automatización Reglas Alertas Seguimientos Procesos automáticos

---

FASE 5 Inteligencia Artificial Optimización Predicción Asistentes Análisis

PRIORIDAD INMEDIATA

1. Cerrar completamente Presence Engine Backend Persistencia Reporting Mapa Timeline

---

2. Completar Reporting Engine Todos los Engines deberán alimentar Reporting.

---

3. Automation Engine Disparadores Reglas Procesos automáticos

---

4. Finalizar Comercial Agenda Visitas Mobile

ROADMAP POR ENGINE

PLANNING ENGINE Pendiente Optimización automática Balanceo IA Sugerencias Estimación de carga

---

ACTIVITY ENGINE Pendiente Consultas avanzadas Timeline global Auditoría completa

---

ATTACHMENT ENGINE Pendiente Versionado Etiquetas OCR Previsualizaciones

---

PRESENCE ENGINE Pendiente Backend completo Mapa Timeline Heatmaps Tiempo efectivo Alertas Productividad

---

REPORTING ENGINE Pendiente Dashboard ejecutivo KPIs Filtros Comparativas Exportaciones Indicadores históricos

---

AUTOMATION ENGINE Pendiente Motor de reglas Eventos Acciones Escalamientos Integraciones

ROADMAP MOBILE

Bespoke Mobile será una única aplicación. No existirán aplicaciones separadas. Los módulos se habilitan mediante permisos.

---

Módulos previstos Field Operations Commercial Supervisor RRHH Inventario Administración

---

Características futuras Push Firma digital Modo offline completo Sincronización inteligente Geocercas Escaneo QR Escaneo códigos de barras

REPORTING

El Reporting será uno de los pilares del sistema. No mostrará solamente números. Mostrará información útil para tomar decisiones. Ejemplos Tiempo promedio de atención Tiempo efectivo en cliente Tiempo improductivo Cantidad de visitas Conversión comercial Productividad por cuadrilla Materiales utilizados Incidentes Cumplimiento SLA Mapas Ranking Tendencias

AUTOMATIZACIONES

El objetivo es reducir trabajo administrativo. Ejemplos Crear OT automáticamente Recordatorios Escalamientos Cambios de estado Notificaciones Seguimientos Alertas de demora Alertas de SLA Asignaciones automáticas

INTELIGENCIA ARTIFICIAL

La IA no será un módulo. Será transversal. Consumirá información desde todos los Engines.

---

Ejemplos Planificación automática Predicción de atrasos Predicción de carga Optimización de rutas Clasificación automática Resúmenes automáticos Sugerencias de atención Análisis comercial Análisis de productividad Asistente para supervisores Asistente para gerencia

MAPAS

Los mapas tendrán un papel importante. No serán solamente geográficos. Serán herramientas de análisis.

---

Ejemplos Cuadrillas en tiempo real Presencia Obras Cobertura Heatmaps Clientes Oportunidades comerciales

COMERCIAL

Objetivo Construir un CRM completamente integrado con la operación. No un CRM separado.

---

Características futuras Agenda Visitas Rutas Seguimientos Cotizaciones Pipeline Conversión Mapa comercial Presencia comercial

RRHH

Pendiente Capacitaciones Vacaciones Licencias Evaluaciones Historial Documentación Firma digital

INVENTARIO

Pendiente Materiales Depósitos Movimientos Consumos Asignaciones Control por OT Control por empleado

FACTURACIÓN

Pendiente Integración administrativa Facturación Cobranza Morosidad Estados Integraciones futuras

API

Toda nueva funcionalidad deberá exponerse mediante APIs reutilizables. Web y Mobile consumirán los mismos servicios. Nunca desarrollar lógica diferente para cada cliente.

OBJETIVO FINAL

El objetivo no es construir solamente un ERP. El objetivo es construir una plataforma inteligente capaz de administrar completamente una empresa de servicios.

**El sistema deberá:**

Registrar. Analizar. Automatizar. Predecir. Recomendar. Aprender. Ayudar a decidir. Ese será el verdadero diferencial de Bespoke Operations.

Esta sección documenta la metodología utilizada durante el desarrollo del proyecto. Su objetivo es mantener consistencia técnica, arquitectónica y funcional durante toda la evolución de Bespoke Operations.

## 1. FILOSOFÍA DE DESARROLLO

Cada nueva funcionalidad debe responder tres preguntas antes de comenzar. 1. ¿Qué problema resuelve? 2. ¿Puede reutilizar un Engine existente? 3. ¿Cómo impacta en el resto del sistema? Si una funcionalidad rompe alguno de estos principios, debe replantearse antes de implementarse.

## 2. METODOLOGÍA DE TRABAJO

Todo desarrollo sigue siempre el mismo proceso. 1. Analizar necesidad.

↓

2. Diseñar funcionalmente.

↓

3. Diseñar técnicamente.

↓

4. Definir arquitectura.

↓

5. Crear Sprint para Cursor.

↓

6. Implementación.

↓

7. QA funcional.

↓

8. Correcciones.

↓

9. Commit.

↓

10. Push. Nunca realizar Commit antes del QA. Nunca realizar Push sin validar el funcionamiento.

## 3. REPOSITORIOS

Actualmente existen dos proyectos principales.

---

PROYECTO Bespoke Operations Repositorio esperado bespoke-operations Responsabilidad Backend Frontend Web Base de datos Motores APIs Administración

---

PROYECTO Bespoke Mobile Repositorio esperado bespoke-mobile Responsabilidad Aplicación Android Operación en campo Offline GPS Media Pipeline Presence Engine Mobile

---

Ambos proyectos evolucionan de forma independiente. Se comunican únicamente mediante APIs. Nunca compartir lógica de negocio entre ambos mediante copia de código.

## 4. FORMATO DE LOS SPRINTS

Todos los Sprints deberán comenzar con un encabezado claro.

PROYECTO Repositorio esperado Tipo de Sprint Objetivo

Ejemplo PROYECTO Bespoke Operations Repositorio esperado bespoke-operations Tipo Backend Objetivo Implementar Presence Engine Backend.

## 5. CONVENCIONES PARA CURSOR

Los prompts deben ser autocontenidos. No depender de conversaciones anteriores.

**Cada Sprint debe indicar claramente:**

Objetivo. Alcance. Qué implementar. Qué NO implementar. Resultado esperado. Compatibilidad. No dejar lugar a interpretaciones ambiguas.

## 6. QA

**Antes de realizar un Commit deben verificarse como mínimo:**

Compilación. Migraciones. Flujo principal. Casos de error. Compatibilidad. No romper funcionalidades existentes.

**Cuando el Sprint sea Mobile:** Probar en dispositivo real antes del Commit.

## 7. COMMITS

**La política del proyecto es:**

Implementar. ↓ QA. ↓ Commit. ↓ Push. No realizar commits intermedios innecesarios. Cada Commit debe representar una unidad funcional completa.

## 8. PRINCIPIOS DE CÓDIGO

Evitar duplicación. Evitar lógica en componentes. Evitar SQL fuera de Repository. Evitar constantes duplicadas. Centralizar configuración. Mantener compatibilidad. Escribir código reutilizable. Priorizar claridad antes que complejidad.

## 9. FILOSOFÍA UX

La experiencia del usuario tiene la misma importancia que la arquitectura.

**Las pantallas deben ser:**

Simples. Rápidas. Consistentes. Predecibles. Toda información debe tener un propósito. Eliminar ruido visual. Evitar pantallas sobrecargadas.

## 10. FILOSOFÍA MOBILE

Offline First. Sincronización silenciosa. No bloquear al usuario. Compatibilidad hacia atrás. Procesamiento local cuando sea posible. Servidor como autoridad.

## 11. FILOSOFÍA BACKEND

El servidor siempre será la fuente de verdad. Toda validación importante debe realizarse en backend. El cliente puede asistir. Nunca decidir.

## 12. PRIORIDADES ACTUALES

Estado general. Muy avanzado. Arquitectura consolidada. Motores definidos. Aplicación Mobile evolucionando. Comercial en desarrollo. Reporting pendiente. Automation pendiente. IA planificada.

## 13. PRÓXIMOS SPRINTS

Prioridad inmediata. 1. Cerrar Presence Engine Backend.

---

2. Comenzar Reporting Engine.

---

3. Automation Engine.

---

4. Finalizar Comercial.

---

5. Expandir Bespoke Mobile.

## 14. REGLAS PARA FUTURAS DECISIONES

**Antes de agregar un módulo nuevo preguntar:**

¿Existe un Engine que ya resuelva este problema? ¿Puede reutilizarse? ¿Está alineado con la filosofía del producto? ¿Genera duplicación? ¿Escala correctamente? Si la respuesta es negativa, replantear la solución.

## 15. OBJETIVO FINAL DEL PROYECTO

Bespoke Operations no busca competir únicamente con un ERP tradicional.

**El objetivo es construir una plataforma capaz de:**

Administrar. Coordinar. Medir. Analizar. Automatizar. Optimizar. Predecir. Asistir. Todo dentro de una única arquitectura coherente.

## 16. ESTADO ACTUAL (27/07/2026)

ARQUITECTURA ✓ Consolidada.

---

MÓDULOS ✓ RRHH ✓ Clientes ✓ Obras ✓ OT ✓ Planning ✓ Calendario ✓ Atención al Cliente ✓ Dashboard ✓ Comercial (base)

---

ENGINES ✓ Planning ✓ Activity ✓ Attachment ✓ Presence (Mobile) ✓ Auth

**En desarrollo:**

- Reporting
- Automation
- Notification

---

MOBILE ✓ Arquitectura Modular ✓ Media Pipeline ✓ Presence Engine ✓ Offline ✓ Sync Automática

---

BACKEND

**En desarrollo:** Presence Engine Backend

---

ROADMAP Reporting Automation IA Mapas Analítica Optimización

## 17. REFERENCIAS ENTRE PROYECTOS

Bespoke Operations

↓

expone APIs

↓

Bespoke Mobile

↓

genera eventos

↓

Activity Engine

↓

Reporting Engine

↓

Automation Engine

↓

Dashboard Toda la plataforma comparte una única visión de negocio.

## 18. CONCLUSIÓN

Bespoke Operations ha dejado de ser un MVP. Actualmente es una plataforma con una arquitectura sólida, escalable y orientada a motores reutilizables. Las decisiones futuras deberán respetar los principios documentados en este Master Project Context. Este documento deberá actualizarse al finalizar cada bloque importante del proyecto (nuevos Engines, módulos o cambios arquitectónicos relevantes).

---
## FIN DEL DOCUMENTO

**BESPOKE OPERATIONS — MASTER PROJECT CONTEXT — VERSIÓN 1.0**

**Estado del proyecto:** DESARROLLO ACTIVO

**Arquitectura:** CONSOLIDADA

**Próximo objetivo:** Presence Engine Backend → Reporting Engine → Automation Engine.

Este es el contexto oficial del proyecto. A partir de este documento trabajaremos siempre sobre esta base.\n