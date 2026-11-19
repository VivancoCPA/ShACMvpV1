## Why

Guardar una No Conformidad con turno "Todos" devuelve **500 Internal Server Error**: el formulario de NC ofrece `TODOS`, pero el backend reutiliza `IncidentTurno` (solo `DIA`/`TARDE`/`NOCHE`) y la deserialización JSON falla. Además, el manejador global de excepciones convierte *cualquier* error de binding (enum desconocido, JSON mal formado, formato inválido en query string) en un 500 genérico, en todos los endpoints, ocultando al cliente qué campo falló.

## What Changes

- **D1 — Turno propio de la NC:** nuevo enum de dominio `NCTurno` (`TODOS`, `DIA`, `TARDE`, `NOCHE`) usado por `NoConformidad.Turno`, `CrearNoConformidadCommand` y `ActualizarNoConformidadCommand`. Incidentes y QE siguen usando `IncidentTurno` (sin `TODOS`). Sin migración: la columna `turno` ya es texto (`HasConversion<string>()`, `varchar(20)`).
- **D2 — Errores de binding → 400 en toda la API:** `ApiExceptionHandler` mapea `BadHttpRequestException` y `JsonException` a **400** con `ApiResponse.Fail` y un mensaje que nombra el campo (`"Valor inválido en el campo 'turno'."`), sin stack ni texto técnico; el detalle va al log con `LogWarning`. `RouteHandlerOptions.ThrowOnBadRequest = true` en todos los entornos para que el formato de la respuesta sea el mismo en Development y Production.
- **Frontend:** los hooks/formulario de crear y editar NC muestran el `message` del servidor ante un 400 (en lugar del genérico). Detalle y listado ya muestran `form.turno.TODOS` — solo se cubre con test.
- **MSW:** `POST`/`PATCH /api/nonconformities` validan los enums (`turno`, `dominio`, `origen`, `tipo`, `severidad`) y responden 400 con el mismo formato ante un valor desconocido; `turno: 'TODOS'` es válido.

## Capabilities

### New Capabilities
- `be-api-errores-binding`: respuesta 400 uniforme (formato `ApiResponse.Fail`) para errores de binding/deserialización en cualquier endpoint de la API.

### Modified Capabilities
- `be-no-conformidades-api`: la NC acepta y devuelve `turno: 'TODOS'`; un turno desconocido responde 400.
- `nc-msw-handlers`: el mock valida enums de la NC y acepta `TODOS`, con el mismo contrato de error que el backend.
- `nc-form`: ante un 400 del servidor, el formulario muestra el `message` del servidor.
- `nc-detail-page`: el detalle muestra "Todos los turnos" cuando `turno === 'TODOS'`.

## Impact

- Backend: `ShcMvpEndPoint.Domain/Enums/NCTurno.cs` (nuevo), `Entities/NoConformidad.cs`, `Features/NoConformidades/{Crear,Actualizar}NoConformidad/*Command.cs`, `Infrastructure/Middleware/ApiExceptionHandler.cs`, `Program.cs` (`RouteHandlerOptions`). Lecturas Dapper (listado, detalle, dashboard) mapean a la entidad, por lo que heredan el nuevo tipo sin cambios.
- Frontend: `features/nonconformities/hooks/useNonconformities.ts`, `components/NCForm.tsx`, util nuevo de mensaje de error; `mocks/handlers/nonconformities.handlers.ts`.
- Sin migración de base de datos. Sin cambios de contrato para Incidentes ni QE.
