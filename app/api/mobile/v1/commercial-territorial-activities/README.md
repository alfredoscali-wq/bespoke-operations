# Actividad Comercial Territorial — Mobile API (1.0)

Backend endpoints for Bespoke Field Agent. Web UI already ships under
`/gestion-comercial/actividad-comercial`.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/mobile/v1/commercial-territorial-activity-types` | Active types for the company |
| GET | `/api/mobile/v1/commercial-territorial-activities` | Recent field activities |
| POST | `/api/mobile/v1/commercial-territorial-activities` | Create activity (GPS) |
| POST | `/api/mobile/v1/commercial-territorial-activities/:activityId/photos` | Multipart photo upload |

## Create body

```json
{
  "activityTypeId": "uuid",
  "description": "Se dejaron folletos",
  "observations": "opcional",
  "latitude": -34.6,
  "longitude": -58.4,
  "locationSource": "gps"
}
```

## Field Agent UX (client app)

1. Map centered on device GPS
2. Floating `+` → Nueva Actividad
3. Same fields as web: Tipo, Descripción, Foto(s), Observaciones
4. Location from GPS; allow moving the pin
5. Optional photos after create via photos endpoint

Photos use Attachment Engine (`module: commercial`, `recordId: activityId`).
