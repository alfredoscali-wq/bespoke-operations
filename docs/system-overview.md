# System Overview

## Arquitectura General

Bespoke está organizado mediante módulos funcionales y motores compartidos.

Los módulos representan procesos de negocio.

Los motores representan capacidades reutilizables.

---

## Módulos

Dashboard

Comercial

Atención al Cliente

Operaciones

Administración

RRHH

Reportes

---

## Motores

Activity Engine

Agenda Engine

Planning Engine

Automation Engine

Notification Engine

Reporting Engine

---

## Relación

Los módulos generan trabajo.

Los motores procesan ese trabajo.

Los reportes consumen información generada por todos los motores.

---

## Objetivo

Evitar que la lógica se encuentre distribuida dentro de los módulos.

Toda capacidad compartida debe implementarse mediante un motor.

---

## Evolución

Los nuevos módulos deberán reutilizar motores existentes.

Solo se crearán nuevos motores cuando representen capacidades reutilizables por múltiples áreas.
