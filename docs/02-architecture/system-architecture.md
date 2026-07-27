# System Architecture

## Objetivo

Este documento describe la arquitectura oficial de Bespoke.

No documenta tecnologías, frameworks o librerías.

Documenta la forma en que el sistema debe construirse para mantenerse escalable, consistente y mantenible a lo largo del tiempo.

Toda nueva funcionalidad debe respetar esta arquitectura.

---

# Filosofía

Bespoke no está construido alrededor de pantallas.

Tampoco está construido alrededor de tablas de base de datos.

Está construido alrededor del negocio.

El software refleja cómo funciona una empresa.

Las interfaces cambian.

Las tecnologías cambian.

El negocio permanece.

Por ese motivo la arquitectura se organiza alrededor del dominio y no alrededor de la interfaz.

---

# Capas del sistema

La arquitectura está organizada en cuatro grandes capas.

Domain

↓

Core Engines

↓

Business Modules

↓

User Interface

Cada capa tiene responsabilidades claramente definidas.

Las responsabilidades nunca deben mezclarse.

---

# Domain

El Domain representa el lenguaje del negocio.

Aquí viven los conceptos fundamentales del producto.

Ejemplos:

- Persona
- Cliente
- Empleado
- Oportunidad
- Expediente Comercial
- Proyecto
- Orden de Trabajo
- Actividad
- Compromiso

El Domain no conoce pantallas.

No conoce componentes.

No conoce tecnologías.

Describe únicamente el negocio.

---

# Core Engines

Los Core Engines representan capacidades reutilizables del sistema.

No pertenecen a ningún módulo específico.

Pueden ser utilizados simultáneamente por Comercial, Atención al Cliente, Operaciones, RRHH o cualquier futuro módulo.

Los Engines implementan comportamiento compartido.

No implementan procesos específicos de un área.

Ejemplos:

Activity Engine

Agenda Engine

Planning Engine

Automation Engine

Notification Engine

Reporting Engine

---

# Business Modules

Los módulos representan áreas funcionales de la empresa.

Ejemplos:

Comercial

Atención al Cliente

Operaciones

Administración

Recursos Humanos

Dashboard

Cada módulo coordina procesos propios de su área.

No implementa capacidades generales.

Cuando necesita registrar actividades utiliza el Activity Engine.

Cuando necesita generar trabajo futuro utiliza el Agenda Engine.

Cuando necesita planificar recursos utiliza el Planning Engine.

Cuando necesita automatizar procesos utiliza el Automation Engine.

Los módulos reutilizan Engines.

Nunca duplican su lógica.

---

# User Interface

La interfaz representa únicamente la experiencia del usuario.

Su responsabilidad es:

- mostrar información;
- capturar acciones;
- facilitar la interacción.

La interfaz no contiene reglas de negocio.

No implementa procesos.

No toma decisiones funcionales.

Toda lógica pertenece a capas inferiores.

---

# Flujo de responsabilidades

La arquitectura sigue un flujo descendente.

Domain

↓

Core Engines

↓

Business Modules

↓

User Interface

Cada nivel utiliza únicamente las capacidades del nivel inferior.

Nunca ocurre el flujo inverso.

---

# Independencia

Cada capa puede evolucionar de manera independiente.

Es posible:

cambiar una pantalla,

sin modificar un Engine.

Es posible:

agregar un nuevo módulo,

sin modificar el Domain.

Es posible:

crear nuevos procesos,

sin reescribir funcionalidades existentes.

Esta independencia constituye una de las principales fortalezas de Bespoke.

---

# Escalabilidad

Toda nueva funcionalidad debe responder primero una pregunta.

¿Pertenece al negocio?

¿Pertenece a un Engine?

¿Pertenece a un módulo?

¿O pertenece únicamente a la interfaz?

Responder correctamente esa pregunta evita duplicación de código y mantiene una arquitectura consistente.

---

# Objetivo final

El propósito de esta arquitectura no es únicamente organizar código.

Su objetivo es permitir que Bespoke pueda crecer durante años incorporando nuevos módulos, nuevas industrias y nuevos procesos sin perder consistencia.

La arquitectura debe facilitar la evolución del producto, nunca limitarla.
