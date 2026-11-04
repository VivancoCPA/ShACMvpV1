# INSTRUCCIONES PARA CLAUDE CODE — QE: guardar los 5 Porqués / Ishikawa y firmar la causa raíz con PIN verificado

- **Fecha:** 2026-10-26
- **Autor:** Cowork (para Toño)
- **Origen:** Toño reportó que, al editar un QE para cargar el análisis, no se guarda la investigación con el método de los 5 Porqués ni con el diagrama de Ishikawa. Al revisar el código apareció además que la firma de la causa raíz no verifica el PIN.
- **Change OpenSpec:** `qe-analisis-causa-raiz-fix`
- **Flujo:** `/opsx:sync → /opsx:propose → /opsx:apply → /opsx:archive`
- **Relación con otros changes:**
  - es independiente de los de incidentes y puede ir antes;
  - el asistente de IA va en un change aparte, `qe-asistente-ia`, que se aplica **después** de este.
- **Sin migración.**

---

## 1. Diagnóstico confirmado leyendo el código

### 1.1 El frontend y el backend no coinciden en el formato del análisis

- **Frontend:** `shc-controldoc/src/features/quality-events/components/QEInvestigationSection.tsx`, en `onGuardar` (alrededor de la línea 166), envía:
  - `cincoPorques: { pregunta, respuesta }[]`
  - `ishikawa: { categoria, causa }[]`

  Esos tipos están en `types/qualityEvent.types.ts:47–55` y `:151–152`.
- **Backend:** `ActualizarQualityEventCommand` declara `string? CincoPorques` y `string? Ishikawa`. La entidad los guarda en columnas `text` (`cinco_porques` e `ishikawa`, en la migración `AddQualityEvents`).
- **Al guardar:** System.Text.Json no puede convertir un array JSON en un `string`, así que el binding falla con **400** y se rechaza **toda** la petición. Por eso tampoco se guarda `causaRaizDefinitiva`, que va en la misma llamada.
- **Al leer:** `ObtenerQualityEventHandler` devuelve `CincoPorques` e `Ishikawa` como texto. El frontend los indexa como arrays (`qe.cincoPorques?.[idx]?.respuesta`) y no muestra nada.

### 1.2 La firma de la causa raíz no verifica el PIN (RN-QE-002)

- `QEInvestigationSection.tsx`: el `PinModal` valida el formato de 4 dígitos y llama a `onConfirm(pin)`. Pero `onPinConfirm` (alrededor de la línea 193) **ignora el PIN** y hace un `PATCH /api/quality-events/{id}` con:
  - `causaRaizFirmadaEn: new Date().toISOString()` (la hora del cliente);
  - `causaRaizAprobadaPorId: user?.id`.
- `ActualizarQualityEventHandler` (líneas 92–100) acepta esos dos campos del body **sin verificar** el PIN, el rol ni la identidad.
- **Consecuencia:** la "firma" que exige `TransicionarEstadoQEHandler` para pasar a EN_EJECUCION (RN-QE-002) no prueba nada. Cualquiera que pueda llamar al PATCH podría firmar a nombre de otra persona.
- Ya existe el patrón correcto de verificación del PIN en `FirmarCierreQEHandler` y en `FirmarPublicarDocumentoHandler`: `IPasswordHasher<ShacUser>` contra `PinHash`, más los códigos `PIN_NO_CONFIGURADO` y `PIN_INCORRECTO` del change `pin-olvidado-pista`.

### 1.3 Quién edita el análisis

- En el frontend, `isEditable` (`QEInvestigationSection.tsx:131`) permite editar solo al `JEFE_CALIDAD_SYST`, en EN_INVESTIGACION o ANALISIS_COMPLETADO.
- El PRD §1.3 (estado 3) dice que **el responsable investigador** completa la causa raíz y pasa a ANÁLISIS COMPLETADO, y que el **Jefe de Calidad** la aprueba y la firma.
- Desde `qe-precarga-incidente-responsable` existe `responsableInvestigacionId`, así que el responsable asignado también debe poder editar el análisis.
- En el backend, verificar si `ActualizarQualityEventHandler` valida rol o estado para los campos de análisis. Si no lo hace, agregar la validación (ver §3.1c).

---

## 2. Decisiones de Toño

- **D1:** el backend recibe y devuelve **listas tipadas** y las guarda como **JSON** en las columnas `text` que ya existen. No hay migración. Se valida la estructura.
- **D2:** la causa raíz se aprueba con un **endpoint propio y el PIN verificado en el servidor**. Solo puede hacerlo el JCA; el servidor fija quién firma y cuándo, y deja registro en el audit trail. Los campos de firma salen del PATCH genérico.
- **Consecuencia de la decisión de responsable del change anterior,** alineada con el PRD §1.3: además del JCA, el **responsable de investigación asignado** puede editar el análisis. **Solo el JCA aprueba y firma.**

---

## 3. Qué implementar

### 3.1 Backend (`ShcMvpEndPoint/`)

**a) DTOs tipados** (`Features/QualityEvents/Shared/AnalisisCausaRaizDtos.cs`)

```csharp
public sealed record CincoPorqueItem(string Pregunta, string Respuesta);
public sealed record IshikawaItem(IshikawaCategoria Categoria, string Causa);
public enum IshikawaCategoria { METODO, MAQUINA, MATERIAL, MANO_DE_OBRA, MEDICION, MEDIO_AMBIENTE }
```

- **Los literales del enum deben coincidir exactamente** con `IshikawaCategoria` de `qualityEvent.types.ts`. Copiarlos de ahí; los de arriba son una referencia.
- `MetodoAnalisis` también debe validarse contra los dos valores del frontend (`'5_PORQUES' | 'ISHIKAWA'`). Como `5_PORQUES` no es un identificador válido de C#, mantenerlo como `string` validado en el validator.

**b) Persistencia y lectura**

- En `ActualizarQualityEventCommand`, cambiar los tipos a `List<CincoPorqueItem>? CincoPorques` y `List<IshikawaItem>? Ishikawa`.
- En el handler, serializar con `JsonSerializer.Serialize(..., opciones camelCase + JsonStringEnumConverter)` y guardar en `qe.CincoPorques` / `qe.Ishikawa`. La entidad y las columnas siguen siendo `string`.
- En la **lectura** (`ObtenerQualityEventHandler` y donde se arme la respuesta del QE, incluidos los endpoints de escritura que devuelven la entidad):
  - exponer `cincoPorques` e `ishikawa` como **arrays**;
  - recomendado: propiedades `[NotMapped]` de solo lectura que deserializan, más `[JsonIgnore]` sobre las columnas crudas, con el mismo patrón que `Incidente.Ubicacion`;
  - si el texto guardado no es JSON válido (datos viejos), devolver `null` y registrar un warning. **Nunca un 500.**
- Revisar que **ningún otro lugar** lea esas columnas como texto (por ejemplo, la exportación a PDF `ExportarPdfQE` o `buildQualityEventPdf.ts` en el frontend). Adaptarlos para que muestren las filas.

**c) Validación** (validator del command y handler)

- `MetodoAnalisis` ∈ {`5_PORQUES`, `ISHIKAWA`}.
- Si `MetodoAnalisis = 5_PORQUES`: `CincoPorques` trae exactamente 5 ítems, cada respuesta de 2.000 caracteres como máximo (las respuestas vacías se permiten mientras sea borrador), y al guardar se limpia `Ishikawa` (se pone en null), porque el PRD dice "solo uno activo por QE".
- Si `MetodoAnalisis = ISHIKAWA`: se esperan las 6 categorías, sin repetidas, cada causa de 2.000 caracteres como máximo, y al guardar se limpia `CincoPorques`.
- **Permiso para editar el análisis** (`MetodoAnalisis`, `CincoPorques`, `Ishikawa`, `CausaRaizDefinitiva`):
  - estado EN_INVESTIGACION o ANALISIS_COMPLETADO;
  - actor JCA (rol global) **o** `qe.ResponsableInvestigacionId == actorId`.
  - En otro caso, 403. Si la causa raíz ya está firmada, `CausaRaizDefinitiva` no se puede cambiar: 422 `CAUSA_RAIZ_FIRMADA`.
- **Audit trail:** el `TrackChange` actual guarda el valor anterior y el nuevo. Para `cincoPorques` / `ishikawa`, en lugar del JSON completo, registrar un resumen: "5 Porqués actualizado (3 de 5 respuestas completas)".

**d) Quitar la firma del PATCH genérico**

- Eliminar `CausaRaizAprobadaPorId` y `CausaRaizFirmadaEn` de `ActualizarQualityEventCommand` y de su handler.
- Buscar con grep otros usos (MSW, tests, `useUpdateQualityEvent`) y quitarlos.

**e) Nuevo endpoint `POST /api/quality-events/{id}/aprobar-causa-raiz`** (slice `AprobarCausaRaizQE`)

- **Body:** `{ pin: string }`. Se valida que sean 4 dígitos.
- **Validaciones, en este orden:**
  1. Un QE de otra empresa responde 404.
  2. Solo el JCA por rol global; cualquier otro rol, 403.
  3. El estado debe ser EN_INVESTIGACION o ANALISIS_COMPLETADO; si no, 422.
  4. `CausaRaizDefinitiva` debe tener entre 100 y 500 caracteres (PRD §1.2); si no, 422 `CAUSA_RAIZ_INVALIDA`.
  5. Si ya está firmada, 422 `CAUSA_RAIZ_FIRMADA`.
  6. PIN: sin PIN configurado, `PIN_NO_CONFIGURADO`; PIN incorrecto, `UnauthorizedBusinessException("PIN incorrecto", "PIN_INCORRECTO")`. Es el mismo código que el interceptor de axios ya trata sin intentar refrescar la sesión.
- **Efecto:** `CausaRaizAprobadaPorId = actorId`, `CausaRaizFirmadaEn = DateTime.UtcNow`, `ActualizadoEn = now`.
- **Audit trail:** `CAUSA_RAIZ_APROBADA`, con `ValorNuevo` = un extracto de 100 caracteres de la causa raíz y el actor.
- **Respuesta:** 200 con el QE actualizado.

**f) Volver a editar después de firmar**

- No hay "desfirmar" en este change. Si el análisis necesita cambios después de la firma, el flujo es la reapertura.
- Anotar en `design.md` si en la práctica hace falta un "retirar aprobación".

### 3.2 Frontend (`shc-controldoc/src/features/quality-events/`)

**a) `QEInvestigationSection.tsx`**

- `isEditable`: JCA **o** el responsable asignado (`qe.responsableInvestigacionId === user.id`), en EN_INVESTIGACION o ANALISIS_COMPLETADO, y sin causa raíz firmada para el campo de causa raíz.
- `onGuardar`: sigue enviando las listas tipadas tal como están (ya coinciden con el contrato nuevo).
  - En éxito: toast "Análisis guardado".
  - En error: el mensaje del servidor.
  - Al cambiar de herramienta, la otra lista no se envía; el servidor la limpia.
- `onPinConfirm(pin)`: llamar al nuevo hook `useAprobarCausaRaiz` → `POST /aprobar-causa-raiz` con `{ pin }`. **No** enviar fecha ni aprobador.
  - Errores dentro del modal: `PIN_INCORRECTO` muestra "PIN incorrecto." en el modal; `PIN_NO_CONFIGURADO` muestra el aviso con el enlace a `/perfil#pin-firma`, igual que en el modal de firma de documentos (`pin-olvidado-pista`).
  - Agregar también el enlace "¿Olvidaste tu PIN?".
- El botón "Aprobar causa raíz" lo ve **solo el JCA**. El responsable que no es JCA ve el estado: "Pendiente de aprobación del Jefe de Calidad".
- Si hay cambios sin guardar en la causa raíz, guardarlos (o pedir que se guarden) **antes** de abrir el modal de PIN, porque el servidor valida lo que tiene guardado.

**b) Tipos y API:** quitar `causaRaizAprobadaPorId` y `causaRaizFirmadaEn` del tipo de update. Agregar `aprobarCausaRaiz(id, pin)` en `api/quality-events.api.ts`.

**c) PDF** (`export/buildQualityEventPdf.ts`): si hoy imprime `cincoPorques` o `ishikawa` como texto, adaptarlo a las listas: una fila por porqué o por categoría.

**d) i18n (`qualityEvents`, es-PE y en-US)**

| Clave | es-PE | en-US |
|---|---|---|
| `detail.investigation.guardado` | Análisis guardado. | Analysis saved. |
| `detail.investigation.pendienteAprobacion` | Pendiente de aprobación del Jefe de Calidad. | Pending Quality Manager approval. |
| `detail.investigation.errors.PIN_INCORRECTO` | PIN incorrecto. | Incorrect PIN. |
| `errors.CAUSA_RAIZ_FIRMADA` | La causa raíz ya fue aprobada y no se puede modificar. | The root cause is already approved and can't be changed. |
| `errors.CAUSA_RAIZ_INVALIDA` | La causa raíz debe tener entre 100 y 500 caracteres. | The root cause must be 100 to 500 characters. |

Agregar también la etiqueta del audit trail `CAUSA_RAIZ_APROBADA` ("Causa raíz aprobada").

### 3.3 MSW

- `PATCH /api/quality-events/:id`: aceptar las listas y devolverlas como listas. Ignorar los campos de firma.
- `POST /api/quality-events/:id/aprobar-causa-raiz`: con el PIN del fixture, devuelve 200; con otro PIN, 401 `PIN_INCORRECTO`; si el usuario no es JCA, 403.
- Actualizar los fixtures de QE para que `cincoPorques` e `ishikawa` sean arrays.

---

## 4. Tests

**Backend**
- PATCH con 5 Porqués (5 ítems): 200. El GET siguiente devuelve el array idéntico, e `ishikawa` queda en null.
- PATCH con Ishikawa (6 categorías): 200. `cincoPorques` queda en null.
- Validación: 4 porqués, 7 categorías, una categoría repetida o un método inválido devuelven 400.
- Permisos:
  - el JCA puede editar;
  - el SUPERVISOR responsable asignado puede editar;
  - un SUPERVISOR no asignado recibe 403;
  - un QE en ABIERTO devuelve 403 o 422 (documentar cuál en `design.md`).
- El PATCH ya **no** acepta `causaRaizFirmadaEn` ni `causaRaizAprobadaPorId`: si vienen, se ignoran y no cambian nada.
- `aprobar-causa-raiz`:
  - JCA con PIN correcto: 200, guarda al firmante y la fecha, y registra `CAUSA_RAIZ_APROBADA`;
  - PIN incorrecto: 401 `PIN_INCORRECTO`;
  - sin PIN configurado: `PIN_NO_CONFIGURADO`;
  - SUPERVISOR: 403;
  - causa raíz de menos de 100 caracteres: 422;
  - ya firmada: 422;
  - otra empresa: 404.
- Con la causa raíz aprobada por el endpoint nuevo, la transición a EN_EJECUCION (RN-QE-002) funciona.
- Un dato viejo no-JSON en `cinco_porques` hace que el GET responda 200 con `cincoPorques: null`.

**Frontend**
- Guardar los 5 Porqués y recargar: las respuestas siguen ahí. Lo mismo con Ishikawa.
- Modal de PIN:
  - envía `{ pin }` al endpoint nuevo;
  - `PIN_INCORRECTO` muestra el error dentro del modal;
  - `PIN_NO_CONFIGURADO` muestra el enlace a Mi Perfil.
- El SUPERVISOR responsable puede editar pero no ve "Aprobar"; un SUPERVISOR no asignado ve el análisis en solo lectura.

---

## 5. Reglas de siempre

- Toda divergencia entre esta instrucción y el código real va en `design.md`, con su motivo.
- Correr la **suite completa** (frontend y backend) + `tsc --noEmit` + **`npm run lint` con cero errores**.
- Antes de la prueba manual: **detener el backend → `dotnet build`** (sin migración) → `dotnet run` → Ctrl+F5. Si el endpoint nuevo devuelve 404, cerrar el `ShcMvpEndPoint.exe` que quedó colgado.
- **Prueba manual con MSW apagado:**
  1. Como JCA, en un QE en EN_INVESTIGACION, completar los 5 Porqués y la causa raíz (100 caracteres o más) y guardar. Aparece "Análisis guardado". Con F5, todo sigue ahí.
  2. Cambiar a Ishikawa, completarlo y guardar. Con F5, se ve el Ishikawa y los 5 Porqués quedaron limpios.
  3. Hacer clic en "Aprobar causa raíz" e ingresar un PIN incorrecto: aparece el error en el modal, sin cerrar la sesión. Con el PIN correcto, se ve "Aprobado por {nombre}, {fecha}" y el audit trail muestra `CAUSA_RAIZ_APROBADA`.
  4. Avanzar a EN_EJECUCION: funciona (RN-QE-002).
  5. Como el SUPERVISOR asignado como responsable de otro QE: puede editar y guardar el análisis, pero no ve "Aprobar".
  6. Exportar el QE a PDF: el análisis sale con sus filas.
- Toño avisa con **"listo"** para que Cowork verifique.
