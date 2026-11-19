## Context

Reporte de Toño (2026-11-18): guardar una NC con `turno: "TODOS"` devuelve 500. Diagnóstico confirmado en el código:

- Frontend: `NCForm.tsx` ofrece `<option value="TODOS">`; `createNC.schema.ts` y `nonconformity.types.ts` ya declaran `'TODOS' | 'DIA' | 'TARDE' | 'NOCHE'`.
- Backend: `NoConformidad.Turno`, `CrearNoConformidadCommand.Turno` y `ActualizarNoConformidadCommand.Turno` son `IncidentTurno?` (solo `DIA`/`TARDE`/`NOCHE`). El comentario de la entidad asumía que `TODOS` era "exclusivo de filtro de UI" — falso para la NC, donde el formulario lo envía como valor real.
- `JsonStringEnumConverter` falla con `TODOS` → `JsonException` envuelta en `BadHttpRequestException` (los tests y Development corren con `RouteHandlerOptions.ThrowOnBadRequest = true` por defecto) → `ApiExceptionHandler` cae en `_ => 500`.

## Goals / Non-Goals

**Goals:**
- La NC acepta, persiste y devuelve `TODOS` (D1).
- Cualquier error de binding/deserialización en cualquier endpoint responde 400 con `ApiResponse.Fail` y el campo que falló (D2).
- El formulario de NC muestra el mensaje del servidor ante un 400.

**Non-Goals:**
- Agregar `TODOS` a Incidentes o QE (`IncidentTurno` no cambia).
- Rediseñar el formato de errores de validación de FluentValidation (`ValidationFilter<T>`/`FieldValidationException` siguen igual).

## Decisions

### D1 — Enum propio `NCTurno`
`ShcMvpEndPoint.Domain/Enums/NCTurno.cs` con `TODOS, DIA, TARDE, NOCHE`. Se usa en `NoConformidad.Turno`, `CrearNoConformidadCommand.Turno` y `ActualizarNoConformidadCommand.Turno`.
- *Alternativa descartada:* agregar `TODOS` a `IncidentTurno` — habría permitido `TODOS` en Incidentes y QE, contra la decisión D1 de Toño.
- **DTOs de lectura:** no hay DTO separado — listado (`ListarNoConformidadesHandler`), detalle (`ObtenerNoConformidadHandler`) y dashboard (`DashboardDataFetcher.FetchNoConformidadesAsync`) mapean con Dapper directo a la entidad `NoConformidad`, así que heredan el tipo `NCTurno?` sin cambios. Dapper convierte el texto de la columna con `Enum.Parse`, por lo que el literal `TODOS` ya persistido se lee bien.
- **Sin migración (confirmado):** `ShacDbContext` configura `entity.Property(e => e.Turno).HasConversion<string>().HasMaxLength(20)` para `NoConformidad`. Cambiar el tipo CLR del enum no cambia la columna (`varchar(20)`, mismos literales + `TODOS`). Se verifica con `dotnet ef migrations has-pending-model-changes` (o `migrations add` descartable) durante apply.
- **Cruces con `IncidentTurno` (grep):** ninguno. `CrearQualityEventHandler` con `NcId` no copia el turno de la NC (el turno del QE lo envía el cliente en `CrearQualityEventCommand.Turno`), y el frontend (`QualityEventForm.tsx`) solo precarga el turno desde un **Incidente**, no desde una NC. El dashboard solo agrega NCs por otros campos. No hay ningún lugar que convierta un turno de NC en `IncidentTurno`, así que no hubo que tocar nada para la regla "TODOS → turno vacío" — queda como requisito en la spec para conversiones futuras.

### D2 — `ApiExceptionHandler` mapea errores de binding a 400
Antes del caso por defecto:
- `BadHttpRequestException { InnerException: JsonException je }` → 400 con el campo de `je.Path`.
- `BadHttpRequestException` sin `JsonException` interna (query string, ruta, header, body vacío) → 400. El nombre del parámetro se extrae del mensaje del framework (`Failed to bind parameter "NCEstado? estado" from "XYZ".`) con una regex; si no se reconoce, mensaje genérico `"Solicitud inválida."`. Se respeta `ex.StatusCode` cuando el framework indica otro 4xx (p.ej. 413/415).
- `JsonException` suelta → 400 con el campo de `Path`.
- Mensajes: `"Valor inválido en el campo 'turno'."`, `"Valor inválido en el parámetro 'estado'."`, `"El cuerpo de la solicitud no es un JSON válido."` (cuando `Path` es `$` o vacío). Nunca el texto ni el stack de la excepción.
- Log: `LogWarning(exception, ...)` para estos casos; `LogError` solo para 500.
- **Conversión de path:** `$.turno` → `turno`; `$.acciones[0].tipo` → `acciones[0].tipo`; `$` → sin campo.

### D2b — `ThrowOnBadRequest = true` en todos los entornos
`builder.Services.Configure<RouteHandlerOptions>(o => o.ThrowOnBadRequest = true)` en `Program.cs`. Por defecto el framework solo lanza la excepción en Development; en Production responde 400 **sin body**. Forzarlo hace que el handler global formatee igual en todos los entornos (el frontend siempre recibe `message`).
- *Alternativa descartada:* dejar el default — Production quedaría con un 400 vacío, inconsistente con D2 ("con el campo y el valor que falló").

### `ValidationFilter<T>` no interfiere
El filtro de endpoint corre **después** del binding. Si el binding falla, la excepción ocurre antes de los filtros y solo el handler global responde. Con body válido, el filtro sigue funcionando igual (sin cambios).

### GUID inválido en la ruta → 404
Todas las rutas de NC usan `{id:guid}`; `GET /api/nonconformities/abc` no coincide con ninguna ruta y el framework responde **404** (sin pasar por el handler). Se cubre con test. Una ruta sin restricción con parámetro `Guid` produciría `BadHttpRequestException` → 400 por D2.

### Frontend
- Util `getServerErrorMessage(error, fallback)` en `features/nonconformities/utils/` que devuelve `response.data.message` solo para 400 (otros códigos → fallback, para no mostrar textos 5xx). Usado en `NCForm.tsx` (que llama `mutateAsync` directo) y en `useCreateNonconformity`/`useUpdateNonconformity`.
- Detalle (`NonconformityDetailPage`) ya renderiza `t(\`form.turno.${nc.turno}\`)` y la clave `TODOS` existe en es-PE/en-US; el listado de NC no muestra columna de turno. Solo se agrega test.

### MSW
`POST`/`PATCH /api/nonconformities` validan enums (`turno`, `dominio`, `origen`, `tipo`, `severidad`) contra listas locales y responden `err("Valor inválido en el campo '<campo>'.", 400)`.

## Risks / Trade-offs

- [Regex sobre el mensaje del framework para el nombre del parámetro puede romperse entre versiones de ASP.NET] → fallback a mensaje genérico; nunca 500.
- [`ThrowOnBadRequest = true` en Production cambia la forma del 400 (de vacío a `ApiResponse`)] → es el comportamiento deseado; ningún cliente depende del 400 vacío.
- [`JsonException.Path` puede apuntar a un campo anidado] → se muestra el path relativo completo (`acciones[0].tipo`), suficiente para depurar.

## Divergencias con la instrucción

- §3.1a pide "los DTO de lectura de NC si lo exponen": no existen DTOs separados (Dapper mapea a la entidad) — ver D1.
- §3.1a pide anotar cada lugar donde la NC se cruza con `IncidentTurno`: no hay ninguno — ver D1. Por eso no hay test "NC con TODOS → QE con turno vacío" (no existe la conversión).
- §3.2 "listado muestra Todos": el listado de NC no tiene columna de turno; solo aplica al detalle.
- Se agrega D2b (`ThrowOnBadRequest`) no mencionado en la instrucción, para que D2 valga también en Production.
- §4 "ante un 400, el formulario muestra el mensaje del servidor": el test cubre `getServerErrorMessage` (unitario) y los hooks `useCreateNonconformity`/`useUpdateNonconformity` (`renderHook`). `NCForm.tsx` llama `mutateAsync` directo con la misma util; `NCForm.test.tsx` mockea `@tanstack/react-query` y `useAreas` devuelve `[]`, por lo que no se puede enviar un formulario válido ahí sin reescribir esos mocks — se deja cubierto por la util compartida.
- §4 "si existe la conversión NC → QE": no existe (ver D1), no se agrega ese test.
- §3.1a "confirmar en EF que no hace falta migración": se cubre con un test permanente (`ModeloEf_SinCambiosPendientes_NoRequiereMigracion`, `Database.HasPendingModelChanges()`), porque `dotnet ef` no podía compilar mientras el backend local estaba corriendo (DLLs bloqueadas).
