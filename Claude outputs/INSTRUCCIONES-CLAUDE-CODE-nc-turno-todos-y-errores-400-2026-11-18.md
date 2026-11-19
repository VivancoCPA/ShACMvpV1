# INSTRUCCIONES PARA CLAUDE CODE — NC: aceptar el turno "Todos" y responder 400 (no 500) ante datos inválidos

- **Fecha:** 2026-11-18
- **Autor:** Cowork (para Toño)
- **Origen:** Toño recibe **500 Internal Server Error** al guardar una No Conformidad desde el módulo de NC. Este fue el payload enviado:
  ```json
  { "dominio": "CALIDAD", "origen": "INSPECCION_INTERNA", "tipo": "PRODUCTO", "severidad": "BAJA",
    "titulo": "…", "areaId": "area-008", "procesoInvolucrado": "Pesaje", "descripcion": "…",
    "fechaDeteccion": "2026-11-17", "fechaCierre": "2026-11-30",
    "detectadoPorId": "01a111fe-…", "requiereIPER": true, "turno": "TODOS",
    "mineralInvolucrado": "Cobre", "accionInmediata": "…", "documentosVinculados": [] }
  ```
- **Change OpenSpec:** `nc-turno-todos-y-errores-400`
- **Flujo:** `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`
- **Sin migración**, porque la columna `turno` es de texto. Confirmarlo en la configuración de EF; si no lo es, anotarlo en `design.md` y crear la migración que haga falta.

---

## 1. Diagnóstico confirmado leyendo el código

### 1.1 `"turno": "TODOS"` no existe en el backend

- **Frontend:** `shc-controldoc/src/features/nonconformities/components/NCForm.tsx:407` ofrece `<option value="TODOS">`, y `schemas/createNC.schema.ts:24` y `types/nonconformity.types.ts:165` declaran `'TODOS' | 'DIA' | 'TARDE' | 'NOCHE'`.
- **Backend:** `CrearNoConformidadCommand.Turno` es `IncidentTurno?`, y ese enum (`ShcMvpEndPoint.Domain/Enums/IncidentTurno.cs`) solo tiene `DIA`, `TARDE` y `NOCHE`.
- Con `TODOS`, System.Text.Json no puede deserializar el body y el binding de la minimal API lanza `BadHttpRequestException`, que envuelve una `JsonException`.
- Los demás valores del payload (`NCOrigen.INSPECCION_INTERNA`, `NCTipo.PRODUCTO`, `NCSeveridad.BAJA` y `NCDominio.CALIDAD`) sí existen en los enums del backend.

### 1.2 Todo error de datos sale como 500

- `ShcMvpEndPoint.Infrastructure/Middleware/ApiExceptionHandler.cs:29` tiene `_ => (500, "Error interno del servidor.")`. No contempla `BadHttpRequestException` ni `JsonException`.
- Por eso un body mal formado o un valor de enum desconocido, que debería ser un **400** con el campo que falló, llega como **500 genérico**. Pasa en **todos** los endpoints de la aplicación.

---

## 2. Decisiones de Toño

- **D1:** la NC **acepta el turno "Todos"**, porque una NC puede afectar a todos los turnos (por ejemplo, un instrumento descalibrado). Se usa un **enum propio para la NC**; incidentes y QE siguen con Día, Tarde y Noche.
- **D2:** en **toda la aplicación**, un body inválido (enum desconocido, formato incorrecto, JSON mal formado) responde **400**, con el campo y el valor que falló.

---

## 3. Qué implementar

### 3.1 Backend (`ShcMvpEndPoint/`)

**a) Turno propio de la NC (D1)**

- Nuevo `ShcMvpEndPoint.Domain/Enums/NCTurno.cs` con `TODOS`, `DIA`, `TARDE` y `NOCHE`.
- Usarlo en:
  - `NoConformidad.Turno`;
  - `CrearNoConformidadCommand.Turno`;
  - el command de actualizar NC (`ActualizarNoConformidad`), si incluye el turno;
  - los DTO de lectura de NC (detalle, listado y dashboard), si lo exponen.
- La columna sigue siendo de texto, con los mismos literales que antes más `TODOS`, así que **no hace falta migración**. Si EF muestra cambios de modelo al ejecutar `migrations add`, revisar la configuración.
- **Dónde se cruza con `IncidentTurno`:** buscar con grep todo lugar en que la NC se convierta en un QE o en otra entidad que use `IncidentTurno` (por ejemplo, la precarga o creación de un QE de origen O2 desde una NC, o el dashboard). Si la NC tiene `TODOS`, el turno destino queda **vacío o nulo** en lugar de inventar un valor. Anotar en `design.md` cada lugar que se toque.

**b) Errores de binding → 400 (D2)** (`ApiExceptionHandler.cs`)

- Agregar, **antes** del caso por defecto:
  - `BadHttpRequestException ex` → **400**. Si `ex.InnerException` es una `JsonException`, usar su información;
  - `JsonException ex` → **400**.
- **Mensaje:** usar el formato de `ApiResponse.Fail` del proyecto, con el campo y el problema. Por ejemplo, `"Valor inválido en el campo 'turno'."`. El campo sale de `JsonException.Path` (`$.turno` → `turno`).
- **No incluir** el stack ni el texto completo de la excepción. El detalle técnico va al log con `LogWarning`, no `LogError`, porque es un error del cliente.
- Verificar que el `ValidationFilter<T>` existente no interfiera, porque corre después del binding. Si el binding falla antes, el handler global es el que responde.
- **Revisar** también que errores de formato en la query string o en la ruta (por ejemplo, un GUID inválido) respondan 400 y no 500.

### 3.2 Frontend (`shc-controldoc/src/features/nonconformities/`)

- `NCForm.tsx`, el schema y los tipos ya usan `TODOS`, así que no hay cambios en el formulario.
- Verificar que el **detalle** y el **listado** de NC muestren "Todos" con la etiqueta i18n existente (`form.turno.TODOS`) cuando el backend devuelva `TODOS`.
- **Manejo de errores:** si el formulario de NC (o el hook de crear o actualizar) muestra un mensaje genérico para un 400, mostrar el `message` del servidor.

### 3.3 MSW

- `POST /api/nonconformities` acepta `turno: 'TODOS'`.
- Un enum desconocido responde 400, igual que el backend real.

---

## 4. Tests

**Backend**
- Crear una NC con `turno: "TODOS"` → 201, y el detalle devuelve `TODOS`.
- Crear una NC con `turno: "DIA"` → 201 (regresión).
- Crear una NC con `turno: "XYZ"` → **400**, con un mensaje que menciona `turno`, y **no** 500.
- Un JSON mal formado en cualquier endpoint → 400.
- Un GUID inválido en la ruta (por ejemplo, `GET /api/nonconformities/abc`) → 400 o 404, nunca 500. Anotar en `design.md` cuál de los dos devuelve el framework.
- Si existe la conversión NC → QE: una NC con `TODOS` produce un QE con turno vacío, sin error.

**Frontend**
- El detalle de una NC con `turno: 'TODOS'` muestra "Todos".
- Ante un 400, el formulario muestra el mensaje del servidor.

---

## 5. Reglas de siempre

- Toda divergencia entre esta instrucción y el código real va en `design.md`, con su motivo.
- Correr la **suite completa** (frontend y backend) + `tsc --noEmit` + **`npm run lint` con cero errores**.
- Antes de la prueba manual: **detener el backend → `dotnet build`** (sin migración, salvo lo dicho en §3.1a) → `dotnet run` → Ctrl+F5.
- **Prueba manual con MSW apagado:**
  1. Crear una NC con los mismos datos del payload del reporte, con turno "Todos". Se guarda sin error, aparece en el listado y el detalle muestra "Todos".
  2. Crear otra NC con turno "Día": se guarda bien.
  3. Con DevTools, reenviar el `POST` cambiando `turno` a `"XYZ"` (Network → clic derecho → *Edit and resend*). La respuesta es **400** con un mensaje sobre el turno, no 500.
- Toño avisa con **"listo"** para que Cowork verifique.
