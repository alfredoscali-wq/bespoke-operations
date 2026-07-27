# Agenda Engine

## Objetivo

El Agenda Engine es el motor encargado de administrar todo el trabajo futuro de Bespoke.

Centraliza los Compromisos generados por cualquier módulo del sistema y garantiza que ninguna acción pendiente quede sin seguimiento.

Representa la agenda operativa unificada del producto.

---

# Filosofía

Mientras el Activity Engine registra el pasado, el Agenda Engine administra el futuro.

Todo aquello que todavía debe ocurrir se representa mediante un Compromiso.

No importa desde qué módulo se origine.

Existe una única agenda para todo Bespoke.

---

# Problema que resuelve

En muchos sistemas, las tareas pendientes aparecen distribuidas entre distintos módulos.

Comercial tiene seguimientos.

Operaciones tiene tareas.

Administración tiene recordatorios.

RRHH tiene pendientes.

Esto genera múltiples listas inconexas.

El Agenda Engine unifica todo el trabajo pendiente bajo un único modelo.

---

# Responsabilidades

El Agenda Engine es responsable de:

- crear Compromisos;
- administrar su ciclo de vida;
- asignar responsables;
- controlar fechas previstas;
- organizar prioridades;
- mantener el estado de cada compromiso;
- servir como fuente única del trabajo pendiente.

---

# No es responsabilidad

El Agenda Engine no administra:

- hechos históricos;
- planificación de recursos;
- automatizaciones;
- notificaciones;
- indicadores.

Su responsabilidad termina en la administración del trabajo pendiente.

---

# Concepto fundamental

Todo proceso abierto debe tener un siguiente paso.

Ese siguiente paso es un Compromiso.

Si un proceso no tiene un Compromiso asociado cuando corresponde, existe un riesgo operativo.

---

# Ejemplos

Llamar nuevamente al cliente.

↓

Compromiso.

---

Esperar documentación.

↓

Compromiso.

---

Coordinar visita técnica.

↓

Compromiso.

---

Solicitar aprobación.

↓

Compromiso.

---

Revisar presupuesto.

↓

Compromiso.

---

Contactar proveedor.

↓

Compromiso.

---

# Relaciones

Un Compromiso puede originarse desde cualquier módulo.

Por ejemplo:

Comercial

Atención al Cliente

Operaciones

Administración

Recursos Humanos

Automatizaciones

Todos son administrados por el Agenda Engine.

---

# Ciclo de vida

Creado

↓

Pendiente

↓

En Progreso

↓

Cumplido

o

Cancelado

Cada cambio de estado debe quedar registrado mediante el Activity Engine.

---

# Características

Cada Compromiso posee:

- responsable;
- descripción;
- prioridad;
- fecha prevista;
- contexto;
- estado;
- origen.

Esto permite administrar una agenda homogénea para todo el sistema.

---

# Interacción con otros Engines

## Activity Engine

Registra la creación, actualización y cumplimiento de cada Compromiso.

---

## Planning Engine

Puede transformar un Compromiso operativo en una planificación concreta.

---

## Automation Engine

Puede crear, modificar o cerrar Compromisos automáticamente según reglas del negocio.

---

## Notification Engine

Puede recordar próximos vencimientos o alertar sobre Compromisos críticos.

---

## Reporting Engine

Analiza vencimientos, cumplimiento, tiempos de respuesta y productividad.

---

# Reglas arquitectónicas

Todo Compromiso tiene un responsable.

Todo Compromiso tiene un contexto.

Todo Compromiso tiene un estado.

Todo Compromiso puede completarse o cancelarse.

Un Compromiso nunca representa un hecho histórico.

---

# Principio de agenda única

No existen agendas independientes por módulo.

Existe una única agenda corporativa.

Cada usuario visualiza únicamente los Compromisos que le corresponden según sus permisos y responsabilidades.

Esto garantiza una experiencia consistente y evita duplicación de trabajo.

---

# Objetivo final

El Agenda Engine asegura que todo trabajo futuro tenga seguimiento.

Su misión es evitar que oportunidades, solicitudes, tareas o procesos queden abiertos sin una acción concreta que impulse el negocio hacia adelante.
