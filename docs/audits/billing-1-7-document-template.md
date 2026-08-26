# Facturación 1.7 — Plantilla y diseño del comprobante

## Alcance

Sprint de **presentación**. Crea el modelo visual estándar A4 de Bespoke y permite configurar sus elementos modificables desde:

**Sistema → Configuración → Facturación** → sección **Diseño del comprobante**.

No emite comprobantes, no llama a ARCA ni SIRO, no cambia numeración, impuestos, clientes, servicios, proporcional ni el motor de facturación mensual.

## Diseño

Composición de hoja A4 con mucho espacio en blanco, tipografía limpia y color institucional solo como acento (líneas, títulos pequeños, caja de identificación, encabezado de tabla).

Estructura fija:

1. Encabezado: logo + datos del emisor a la izquierda; caja de identificación a la derecha.
2. Datos del cliente (título pequeño + línea fina + columnas).
3. Conceptos (Cant. · Descripción · P. unitario · Importe).
4. Totales alineados a la derecha; TOTAL con jerarquía fuerte.
5. Observaciones, solo si hay texto y la opción está activa.
6. Leyenda no fiscal obligatoria en Presupuesto y Comprobante X.
7. Zona fiscal reservada: CAE/QR solo si existen. Hoy CAE es NULL y no se muestra.

La letra A/B/C vive en la caja superior derecha. No se usa una letra vertical gigante. Presupuesto, Comprobante X, Nota de crédito y Nota de débito reutilizan el mismo sistema visual.

## Configuración

Columna `isp_billing_company_settings.template_settings` (`jsonb`). No se duplican datos fiscales.

Schema permitido (sin propiedades arbitrarias, sin HTML/CSS):

```json
{
  "show_logo": true,
  "logo_position": "left",
  "show_phone": true,
  "show_email": true,
  "show_address": true,
  "show_observations": true,
  "footer_legend": ""
}
```

Opciones en pantalla:

- Mostrar / ocultar logo
- URL del logo (`logo_url` existente; Storage `isp-billing-logos` si se sube archivo)
- Posición: izquierda, centro, derecha
- Mostrar domicilio, teléfono, email
- Mostrar observaciones
- Leyenda inferior (máx. 240, sin HTML)

La leyenda **DOCUMENTO NO VÁLIDO COMO FACTURA** no es configurable.

## Preview

En la misma pantalla de configuración. Simula A4 (proporción 210×297 mm, hoja blanca, sombra, fondo neutro). Usa datos reales de la empresa y un cliente/conceptos de ejemplo. **No inserta comprobantes.**

Selector: Factura A/B/C, Presupuesto, Comprobante X, Nota de crédito, Nota de débito.

## Snapshot

La plantilla solo cambia presentación.

Comprobantes emitidos en `/facturacion/comprobantes/[id]` y el PDF leen identidad fiscal del **snapshot** del documento (`issuer*Snapshot`, `customer*Snapshot`, importes, numeración, CAE). Un cambio posterior del cliente o de la empresa facturadora no reescribe esos campos.

Los flags actuales de plantilla (mostrar teléfono, posición del logo, leyenda) sí se aplican al renderizar, porque no son datos fiscales.

Los PDF no se archivan: se regeneran al descargar. El layout puede modernizarse; los importes y snapshots no.

## PDF

`lib/isp/billing-document-pdf.ts` consume el mismo view-model que la hoja React (`lib/isp/billing-document-template.ts`). A4, márgenes, tabla con continuación en página 2, totales y pie. Logo desde el snapshot.

## Tests

`npm run test:isp-1-7-document-template`

Cubre empresa, logo, posición, visibilidad, leyenda, preview sin emisión, tipos A/B/C/X/presupuesto/NC/ND, leyenda no fiscal, CAE null, snapshots, PDF, permisos, sanitización y JSON inválido.

Regresiones: 1.6A, 1.6B, 1.6C, UX 2.3.

## Limitaciones

- Una sola empresa facturadora.
- Sin editor visual, HTML ni CSS libre.
- Sin ARCA/SIRO: no hay QR ni CAE reales.
- Impuestos: se muestran los del documento; el motor actual sigue en 0 y no se inventa IVA 21%.
- El logo se referencia por URL; no se guarda binario en la tabla.
