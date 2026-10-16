-- Propuesta. No aplicada.
-- Cierra la carrera entre dos aceptaciones simultáneas con distinto id de Meta
-- para el mismo teléfono, la misma empresa y la misma oferta mientras la
-- solicitud sigue abierta. El control de la aplicación cubre el caso secuencial
-- y conserva el historial terminado (completed, rejected).
-- No modifica clientes, padrón ni LATAM.
--
-- La búsqueda de teléfonos de Clientes 360 no forma parte de este archivo.
-- Un índice por dígitos contiguos omitiría números guardados con espacios o
-- guiones y podría vincular una sola ficha ignorando un duplicado. Hace falta
-- una columna con la misma clave que normalizeWhatsappOriginPhone. No se
-- define aquí para no instalar una expresión distinta a la de la aplicación.

CREATE UNIQUE INDEX IF NOT EXISTS tv_whatsapp_commercial_requests_open_offer_uidx
  ON public.tv_whatsapp_commercial_requests (company_id, origin_phone, offer)
  WHERE status IN ('pending', 'in_review', 'approved');
