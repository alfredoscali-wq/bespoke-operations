# Architecture Principles

## Objetivo

Este documento define los principios arquitectónicos obligatorios de Bespoke.

No son recomendaciones.

Son reglas que toda nueva funcionalidad debe respetar.

Su propósito es mantener una arquitectura consistente a medida que el producto evoluciona.

---

# Principio 1

## El negocio antes que la tecnología

Las decisiones arquitectónicas se toman en función del negocio.

Nunca en función del framework.

Nunca en función de una librería.

Nunca en función de una moda tecnológica.

Las tecnologías pueden cambiar.

El modelo de negocio debe permanecer estable.

---

# Principio 2

## Una única responsabilidad

Cada componente del sistema tiene una única responsabilidad.

El Domain describe el negocio.

Los Engines implementan capacidades.

Los Modules orquestan procesos.

La UI interactúa con el usuario.

Cuando una responsabilidad aparece en dos lugares distintos, la arquitectura comienza a degradarse.

---

# Principio 3

## No duplicar capacidades

Una capacidad compartida debe implementarse una única vez.

Si dos módulos necesitan registrar actividades, ambos utilizan el Activity Engine.

Si dos módulos necesitan generar trabajo futuro, ambos utilizan el Agenda Engine.

Duplicar lógica significa crear deuda técnica.

---

# Principio 4

## Los Engines no pertenecen a ningún módulo

Los Core Engines representan capacidades del producto.

No son propiedad de Comercial.

No son propiedad de Operaciones.

No son propiedad de Atención al Cliente.

Los módulos utilizan Engines.

Nunca ocurre lo contrario.

---

# Principio 5

## Los módulos coordinan procesos

Un módulo representa un área de negocio.

Su responsabilidad consiste en coordinar procesos utilizando los Engines disponibles.

El módulo no debe volver a implementar funcionalidades que ya existen en otro lugar.

---

# Principio 6

## La interfaz no contiene lógica de negocio

Las pantallas muestran información.

Las pantallas capturan acciones.

Las pantallas nunca contienen reglas funcionales.

Una regla de negocio implementada únicamente en la interfaz deja de existir para el resto del sistema.

Toda decisión pertenece a una capa inferior.

---

# Principio 7

## Activity representa el pasado

Las Actividades son hechos.

Nunca representan trabajo pendiente.

Nunca representan recordatorios.

Nunca representan planificación.

Si ocurrió, es una Actividad.

---

# Principio 8

## Commitment representa el futuro

Todo trabajo pendiente debe representarse mediante un Compromiso.

No mediante una Actividad.

No mediante una nota.

No mediante un comentario.

El trabajo futuro tiene una entidad propia.

---

# Principio 9

## El historial nunca se pierde

Las decisiones importantes deben quedar registradas.

Las Actividades forman la memoria operativa del sistema.

Eliminar historia implica perder conocimiento.

Siempre que sea posible se agregan nuevos registros en lugar de modificar los existentes.

---

# Principio 10

## La arquitectura debe crecer sin romperse

Agregar un nuevo módulo no debe requerir modificar los módulos existentes.

Agregar un nuevo proceso no debe requerir reescribir los Engines.

Agregar nuevas pantallas no debe modificar el Domain.

Una arquitectura sana permite crecer mediante extensión, no mediante reemplazo.

---

# Principio 11

## Pensar primero en reutilización

Antes de implementar una nueva funcionalidad debe responderse una pregunta.

¿Esta capacidad podría ser utilizada por otro módulo?

Si la respuesta es sí, probablemente pertenece a un Engine.

Si la respuesta es no, probablemente pertenece al módulo.

---

# Principio 12

## El Domain es el lenguaje oficial

Todos los módulos utilizan el mismo lenguaje.

No existen sinónimos para una misma entidad.

No existen conceptos duplicados.

Las decisiones documentadas en el Domain son la fuente oficial de verdad para todo el producto.

---

# Principio 13

## La arquitectura evoluciona mediante ADR

Las decisiones arquitectónicas importantes no deben cambiarse de manera implícita.

Cuando una decisión de arquitectura evoluciona, debe documentarse mediante un Architecture Decision Record (ADR).

Esto permite comprender por qué una decisión fue tomada y cuándo cambió.

---

# Principio 14

## Favorecer composición antes que dependencia

Los módulos deben construirse utilizando capacidades existentes.

No deben crear dependencias innecesarias entre sí.

Cuanto menor sea el acoplamiento, mayor será la capacidad de evolución del sistema.

---

# Principio 15

## Simplicidad

La arquitectura debe ser tan simple como sea posible.

La complejidad sólo se acepta cuando resuelve un problema real.

Toda abstracción debe aportar valor.

Toda capa debe tener un propósito claro.

---

# Conclusión

Estos principios representan la forma oficial de construir Bespoke.

Cualquier nueva funcionalidad deberá respetarlos.

Cuando exista una duda arquitectónica, este documento tendrá prioridad sobre decisiones locales de implementación.

El objetivo no es únicamente mantener un código limpio.

El objetivo es construir un producto capaz de evolucionar durante muchos años sin perder consistencia.
